import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  RPS_ABI, 
  RPS_BYTECODE, 
  MOVES, 
  MOVE_NAMES,
  saveGameData,
  getGameData,
  removeGameData,
  getStoredGames,
  saveGameResult,
  getGameResult
} from './contracts';
import './App.css';

// local hashing is needed we can't fo it on chain.
const computeCommitmentHash = (move, salt) => {
  return ethers.utils.solidityKeccak256(['uint8', 'uint256'], [move, salt]);
};


const validateAddress = (address) => {
  if (!address || address.trim() === '') {
    return { valid: false, error: 'Address is required' };
  }
  
  try {
    const checksumAddress = ethers.utils.getAddress(address.trim());
    return { valid: true, address: checksumAddress };
  } catch (e) {
    return { valid: false, error: 'Invalid address format. Please enter a valid Ethereum address.' };
  }
};

function App() { 
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [network, setNetwork] = useState(null);
  
  const [contractAddress, setContractAddress] = useState('');
  const [storedGames, setStoredGames] = useState({});
  
  const [gameState, setGameState] = useState(null);
  const [gameResult, setGameResult] = useState(null); 
  const [timeoutSeconds, setTimeoutSeconds] = useState(300);  // defualt this but will fetch from contract
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [createFormData, setCreateFormData] = useState({
    move: MOVES.Rock,
    opponent: '',
    stake: '0.01'
  });
  
  const [playMove, setPlayMove] = useState(MOVES.Rock);
  const [revealData, setRevealData] = useState({ move: MOVES.Rock, salt: '' });

  useEffect(() => { 
    console.log('Checking for Ethereum provider...');
    // Check if window is defined (browser environment)
    if (typeof window === 'undefined') {
      console.log('Running in SSR environment, skipping Web3 initialization');
      return;
    }
    
    // Load stored games from localStorage
    try {
      setStoredGames(getStoredGames());
    } catch (e) {
      console.error('Failed to load stored games:', e);
    }
    
    console.log(window.ethereum);
    if (window.ethereum) {
      const p = new ethers.providers.Web3Provider(window.ethereum);
      console.log('Ethereum provider detected');
      setProvider(p);
      
      p.getNetwork().then(net => setNetwork(net)).catch(err => {
        console.error('Failed to get network:', err);
      });
      
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          // getting only the first one for this 
          setAccount(accounts[0]);
          setSigner(p.getSigner());
        } else {
          setAccount('');
          setSigner(null);
        }
      });
      // I am listening such that I can change network and for now it is metamask so only sepolia I am prefering.  
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
    else{
      alert('hey man! install MetaMask or any Ethereum wallet to use this dApp!');
    }
  }, []);

  const connectWallet = async () => {
    try {
      //by default I am connecting only first one. 
      setError('');
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      setAccount(accounts[0]);
      setSigner(provider.getSigner());
    } catch (err) {
      setError(err.message);
    }
  };

  

  const startGame = async () => {
    try {
      setError('');
      setLoading(true);
      
      
      const opponentValidation = validateAddress(createFormData.opponent);
      if (!opponentValidation.valid) {
        throw new Error(opponentValidation.error);
      }
      
      const opponentAddress = opponentValidation.address;
      
      // Prevent playing against oneself although no loss on smart contract side but still not logical. 
      if (opponentAddress.toLowerCase() === account.toLowerCase()) {
        throw new Error('You cannot play against yourself! Please enter a different opponent address.');
      }

      // Altough no stake ampunt check on contract side but still prefering it  to have it here.
      
      const stakeAmount = Number(createFormData.stake);
      if (isNaN(stakeAmount) || stakeAmount <= 0) {
        throw new Error('Stake amount should be greater than zero');
      }
      
      //salt I am using and it is working behind the scenes like users don't need to worry about it.
      const salt = ethers.BigNumber.from(ethers.utils.randomBytes(32));
      

      const commitmentHash = computeCommitmentHash(createFormData.move, salt);
      
      
      const factory = new ethers.ContractFactory(RPS_ABI, RPS_BYTECODE, signer);
      const stakeWei = ethers.utils.parseEther(createFormData.stake);
      
      const contract = await factory.deploy(
        commitmentHash, 
        opponentAddress,
        { value: stakeWei }
      );
      
      await contract.deployed();
      
      const deployedAddress = contract.address;
      console.log('Contract deployed at:', deployedAddress);
      
      saveGameData(deployedAddress, createFormData.move, salt.toString());
      
      setStoredGames(getStoredGames());
      
     await loadGameState(deployedAddress);
      
      alert(`Game created successfully!\n\nContract Address: ${deployedAddress}\n\nShare this address with your opponent (${opponentAddress}) so they can play.\n`);
      
    } catch (err) {
      console.error('Error starting game:', err);
      setError(err.message || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };  const loadGameState = async (address) => {
    try {
      setError('');
      
   
      const addressValidation = validateAddress(address);
      if (!addressValidation.valid) {
        throw new Error(addressValidation.error);
      }
      
      const validAddress = addressValidation.address;
      
      const contract = new ethers.Contract(validAddress, RPS_ABI, provider);
      
      const [j1, j2, c2, stake, lastAction, timeout] = await Promise.all([
        contract.j1(),
        contract.j2(),
        contract.c2(),
        contract.stake(),
        contract.lastAction(),
        contract.TIMEOUT()
      ]);
      
      const stakeFormatted = ethers.utils.formatEther(stake);
      const isResolved = parseFloat(stakeFormatted) === 0;
      
      
      setTimeoutSeconds(timeout.toNumber());
      
      setGameState({
        j1,
        j2,
        c2: c2,
        stake: stakeFormatted,
        lastAction: lastAction.toNumber(),
        address
      });
      
      setContractAddress(address);
      
      if (isResolved) {
        const savedResult = getGameResult(address);
        setGameResult(savedResult);
      } else {
        setGameResult(null);
      }
      
      // using address so a player can play multiple games with different party or same party. 
      const savedGame = getGameData(address);
      if (savedGame) {
        setRevealData({
          move: savedGame.move,
          salt: savedGame.salt
        });
      } else {
        setRevealData({ move: MOVES.Rock, salt: '' });
      }
      
    } catch (err) {
      setError(err.message || 'Failed to load game state');
    }
  };

  const playAsJ2 = async () => {
    try {
      setError('');
      setLoading(true);
      
      const contract = new ethers.Contract(contractAddress, RPS_ABI, signer);
      
      const stakeWei = ethers.utils.parseEther(gameState.stake);
      
      const tx = await contract.play(playMove, { value: stakeWei });
      await tx.wait();
      
      await loadGameState(contractAddress);
      
      alert('Move played successfully!');
      
    } catch (err) {
      setError(err.message || err.reason || 'Failed to play move');
    } finally {
      setLoading(false);
    }
  };

  const revealMove = async () => {
    try {
      setError('');
      setLoading(true);
      
      if (!revealData.salt) {
        throw new Error('Salt is required to reveal');
      }
      
      const contract = new ethers.Contract(contractAddress, RPS_ABI, signer);
      
      // Check if game is already resolved (stake = 0) and. No zero amount issue as I am checking from frontend. 
      const currentStake = await contract.stake();
      if (currentStake.eq(0)) {
        throw new Error('Game is already resolved. The stake is 0 - either someone already revealed or a timeout was claimed.');
      }
      
   
      const j2Move = gameState.c2;
      const j1Move = revealData.move;
      
      const tx = await contract.solve(revealData.move, revealData.salt);
      await tx.wait();
      
      const j1Wins = await contract.win(j1Move, j2Move);
      const j2Wins = await contract.win(j2Move, j1Move);
      
      let winner;
      if (j1Wins) winner = 'j1';
      else if (j2Wins) winner = 'j2';
      else winner = 'tie';
      
      const result = { winner, j1Move, j2Move };
      setGameResult(result);
      
      saveGameResult(contractAddress, result);
      
      await loadGameState(contractAddress);
      
      // Remove game data from localStorage after successful reveal
      removeGameData(contractAddress);
      setStoredGames(getStoredGames());
      
    } catch (err) {
      setError(err.message || err.reason || 'Failed to reveal move');
    } finally {
      setLoading(false);
    }
  };

  const callJ1Timeout = async () => {
    try {
      setError('');
      setLoading(true);
      
      const contract = new ethers.Contract(contractAddress, RPS_ABI, signer);
      
    
      const currentStake = await contract.stake();
      if (currentStake.eq(0)) {
        throw new Error('Game is already resolved. Cannot claim timeout.');
      }
      
      //checking if j2 played 
      const c2 = await contract.c2();
      if (c2 === MOVES.Null) {
        throw new Error('J2 has not played yet. Cannot claim J1 timeout.');
      }
      
      // Check if timeout passed or not 
      const [lastAction, timeout] = await Promise.all([
        contract.lastAction(),
        contract.TIMEOUT()
      ]);
      const timeoutSeconds = timeout.toNumber();
      const currentTime = Math.floor(Date.now() / 1000);
      const timePassed = currentTime - lastAction.toNumber();
      
      if (timePassed < timeoutSeconds) {
        const remainingTime = timeoutSeconds - timePassed;
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        throw new Error(`Timeout period has not passed yet. Please wait ${minutes}m ${seconds}s more.`);
      }
      
      const tx = await contract.j1Timeout();
      await tx.wait();
      
      await loadGameState(contractAddress);
      
      alert('J1 timeout claimed! You received the stake.');
      
    } catch (err) {
      setError(err.message || err.reason || 'Failed to call j1Timeout');
    } finally {
      setLoading(false);
    }
  };

  const callJ2Timeout = async () => {
    try {
      setError('');
      setLoading(true);
      
      const contract = new ethers.Contract(contractAddress, RPS_ABI, signer);
      
      // Check if game is already resolved
      const currentStake = await contract.stake();
      if (currentStake.eq(0)) {
        throw new Error('Game is already resolved. Cannot claim timeout.');
      }
      
      // j2 should not have played yet
      const c2 = await contract.c2();
      if (c2 !== MOVES.Null) {
        throw new Error('J2 has already played. Cannot claim J2 timeout.');
      }
      
      // Check if timeout period has passed
      const [lastAction, timeout] = await Promise.all([
        contract.lastAction(),
        contract.TIMEOUT()
      ]);
      const timeoutSeconds = timeout.toNumber();
      const currentTime = Math.floor(Date.now() / 1000);
      const timePassed = currentTime - lastAction.toNumber();
      
      if (timePassed < timeoutSeconds) {
        const remainingTime = timeoutSeconds - timePassed;
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        throw new Error(`Timeout period has not passed yet. Please wait ${minutes}m ${seconds}s more.`);
      }
      
      const tx = await contract.j2Timeout();
      await tx.wait();
      
      await loadGameState(contractAddress);
      
      alert('J2 timeout claimed! You received your stake back.');
      
    } catch (err) {
      setError(err.message || err.reason || 'Failed to call j2Timeout');
    } finally {
      setLoading(false);
    }
  };



  const isJ1 = gameState && account && gameState.j1.toLowerCase() === account.toLowerCase();
  const isJ2 = gameState && account && gameState.j2.toLowerCase() === account.toLowerCase();
  const hasJ2Played = gameState && gameState.c2 !== MOVES.Null;
  const gameResolved = gameState && parseFloat(gameState.stake) === 0;
  
  // Safety margin for block.timestamp discrepancy on frontend side (12 seconds for sepolia)
  const TIMEOUT_SAFETY_MARGIN = 12;
  
  // Calculate timeout status using contract timeout with safety margin
  const getTimeoutStatus = () => {
    if (!gameState || gameResolved) return null;
    
    const currentTime = Math.floor(Date.now() / 1000);
    const timePassed = currentTime - gameState.lastAction;
    const effectiveTimeout = timeoutSeconds + TIMEOUT_SAFETY_MARGIN;
    const canTimeout = timePassed >= effectiveTimeout;
    const remainingTime = Math.max(0, effectiveTimeout - timePassed);
    
    return {
      canTimeout,
      remainingTime,
      remainingMinutes: Math.floor(remainingTime / 60),
      remainingSeconds: remainingTime % 60,
      timeoutDuration: timeoutSeconds,
      safetyMargin: TIMEOUT_SAFETY_MARGIN
    };
  };
  
  const timeoutStatus = getTimeoutStatus();

  return (
    <div className="app">
      <h1>Rock Paper Scissors Lizard Spock</h1>
      
      <div className="section">
        <h2>Wallet Connection</h2>
        {!account ? (
          <button onClick={connectWallet}>Connect MetaMask</button>
        ) : (
          <div>
            <p>Connected: {account}</p>
            <p>Network: {network ? `${network.name} (${network.chainId}) ${network.chainId!==11155111 ? 'Please switch to Sepolia' : ''}` : 'Loading...'}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {account && (
        <>
          {(
            <>
              <div className="section">
                <h2>Create New Game (Player 1)</h2>
                <div className="form">
                  <div>
                    <label>Your Move:</label>
                    <select 
                      value={createFormData.move}
                      onChange={(e) => setCreateFormData(prev => ({ 
                        ...prev, 
                        move: parseInt(e.target.value) 
                      }))}
                      required={true}
                    >
                      <option value={MOVES.Rock}>Rock</option>
                      <option value={MOVES.Paper}>Paper</option>
                      <option value={MOVES.Scissors}>Scissors</option>
                      <option value={MOVES.Spock}>Spock</option>
                      <option value={MOVES.Lizard}>Lizard</option>
                    </select>
                  </div>
                  
                  <div>
                    <label>Opponent Address:</label>
                    <input 
                      type="text"
                      value={createFormData.opponent}
                      onChange={(e) => setCreateFormData(prev => ({ 
                        ...prev, 
                        opponent: e.target.value 
                      }))}
                      required={true}
                      placeholder="0x..."
                    />
                  </div>
                  
                  <div>
                    <label>Stake Amount (ETH):</label>
                    <input 
                      type="number"
                      step="any"
                      min="0"
                      value={createFormData.stake}
                      onChange={(e) => setCreateFormData(prev => { 
                        const value = e.target.value;
                        if (value !== '' && isNaN(Number(value))) {
                          return prev;
                        }
                        return { 
                          ...prev, 
                          stake: value 
                        };
                      })}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value === '' || Number(value) <= 0) {
                          alert('Stake amount should be greater than zero');
                        }
                      }}
                      onWheel={(e) => e.target.blur()}
                      required={true}
                    />
                  </div>
                  
                  <button 
                    onClick={startGame} 
                    disabled={loading || !createFormData.opponent || !createFormData.stake}
                  >
                    {loading ? 'Deploying...' : "Let's play"}
                  </button>
                </div>
              </div>

              {/* Stored Games Section */}
              {Object.keys(storedGames).length > 0 && (
                <div className="section">
                  <h2>Your Created Games</h2>
                  <div className="stored-games">
                    {Object.entries(storedGames).map(([address, data]) => (
                      <div key={address} className="stored-game-item">
                        <p><strong>Contract:</strong> {address}</p>
                        <p><strong>Move:</strong> {MOVE_NAMES[data.move]}</p>
                        <p><strong>Created:</strong> {new Date(data.createdAt).toLocaleString()}</p>
                        <button onClick={() => loadGameState(address)}>
                          Load Game
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="section">
                <h2>Load Existing Game</h2>
                <div className="form">
                  <input 
                    type="text"
                    placeholder="Contract Address"
                    value={contractAddress}
                    onChange={(e) => setContractAddress(e.target.value)}
                  />
                  <button onClick={() => loadGameState(contractAddress)} disabled={!contractAddress}>
                    Load Game
                  </button>
                </div>
              </div>
            </>
          )}

          {gameState && !gameResolved && (
            <div className="section">
              <h2>Game State</h2>
              <div className="game-info">
                <p>Contract: {gameState.address}</p>
                <p>Player 1 (J1): {gameState.j1}</p>
                <p>Player 2 (J2): {gameState.j2}</p>
                <p>Stake: {gameState.stake} ETH (each player)</p>
                <p>J2 has played: {hasJ2Played ? `Yes (${MOVE_NAMES[gameState.c2]})` : 'No - waiting for J2'}</p>
                <p>You are: {isJ1 ? 'Player 1' : isJ2 ? 'Player 2' : 'Spectator'}</p>
              </div>
              
              {/* Refresh button for J1 waiting for J2 */}
              {isJ1 && !hasJ2Played && (
                <div className="action-section">
                  <h3>Waiting for Player 2</h3>
                  <p>Player 2 has not played yet. Refresh to check if they have made their move.</p>
                  <button onClick={() => loadGameState(contractAddress)} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh Game State'}
                  </button>
                </div>
              )}

              {isJ2 && !hasJ2Played && (
                <div className="action-section">
                  <h3>Play Your Move (Player 2)</h3>
                  <p>Click refresh before playing to ensure you have the latest game state.</p>
                  <button onClick={() => loadGameState(contractAddress)} disabled={loading} style={{marginBottom: '10px'}}>
                    {loading ? 'Refreshing...' : 'Refresh Game State'}
                  </button>
                  <div className="form">
                    <select 
                      value={playMove}
                      onChange={(e) => setPlayMove(parseInt(e.target.value))}
                    >
                      <option value={MOVES.Rock}>Rock</option>
                      <option value={MOVES.Paper}>Paper</option>
                      <option value={MOVES.Scissors}>Scissors</option>
                      <option value={MOVES.Spock}>Spock</option>
                      <option value={MOVES.Lizard}>Lizard</option>
                    </select>
                    <button onClick={playAsJ2} disabled={loading}>
                      Play Move
                    </button>
                  </div>
                </div>
              )}

              {isJ1 && hasJ2Played && (
                <div className="action-section">
                  <h3>Reveal Your Move (Player 1)</h3>
                  <p>Player 2 played: <strong>{MOVE_NAMES[gameState.c2]}</strong></p>
                  {getGameData(contractAddress) ? (
                    <>
                     
                      <p>Your move: <strong>{MOVE_NAMES[revealData.move]}</strong></p>
                      <div className="form">
                        <button onClick={revealMove} disabled={loading || !revealData.salt}>
                          {loading ? 'Revealing...' : 'Reveal & Resolve Game'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="warning">⚠ No saved game data found. Enter your move and salt manually.</p>
                      <div className="form">
                        <div>
                          <label>Your Move:</label>
                          <select 
                            value={revealData.move}
                            onChange={(e) => setRevealData(prev => ({ 
                              ...prev, 
                              move: parseInt(e.target.value) 
                            }))}
                          >
                            <option value={MOVES.Rock}>Rock</option>
                            <option value={MOVES.Paper}>Paper</option>
                            <option value={MOVES.Scissors}>Scissors</option>
                            <option value={MOVES.Spock}>Spock</option>
                            <option value={MOVES.Lizard}>Lizard</option>
                          </select>
                        </div>
                        <div>
                          <label>Salt:</label>
                          <input 
                            type="text"
                            value={revealData.salt}
                            onChange={(e) => setRevealData(prev => ({ 
                              ...prev, 
                              salt: e.target.value 
                            }))}
                            placeholder="Enter your salt"
                          />
                        </div>
                        <button onClick={revealMove} disabled={loading || !revealData.salt}>
                          {loading ? 'Revealing...' : 'Reveal & Resolve'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="action-section">
                <h3>Timeout Actions</h3>
                <button 
                  onClick={() => loadGameState(contractAddress)} 
                  disabled={loading}
                  style={{marginBottom: '10px'}}
                >
                  {loading ? 'Refreshing...' : 'Refresh Game State & Timer'}
                </button>
                {timeoutStatus && (
                  <p>
                    {timeoutStatus.canTimeout 
                      ? 'Timeout period has passed. You can claim timeout if applicable.'
                      : `Timeout available in: ${timeoutStatus.remainingMinutes}m ${timeoutStatus.remainingSeconds}s (includes ${timeoutStatus.safetyMargin}s safety margin)`
                    }
                  </p>
                )}
                <div className="form">
                  {isJ2 && hasJ2Played && (
                    <button 
                      onClick={callJ1Timeout} 
                      disabled={loading || (timeoutStatus && !timeoutStatus.canTimeout)}
                      title={timeoutStatus && !timeoutStatus.canTimeout ? 'Wait for timeout period to pass' : ''}
                    >
                      {loading ? 'Claiming...' : 'Claim J1 Timeout (J1 didn\'t reveal in time)'}
                    </button>
                  )}
                  {isJ1 && !hasJ2Played && (
                    <button 
                      onClick={callJ2Timeout} 
                      disabled={loading || (timeoutStatus && !timeoutStatus.canTimeout)}
                      title={timeoutStatus && !timeoutStatus.canTimeout ? 'Wait for timeout period to pass' : ''}
                    >
                      {loading ? 'Claiming...' : 'Claim J2 Timeout (J2 didn\'t play in time)'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {gameState && gameResolved && (
            <div className="section">
              <h2>Game Resolved</h2>
              {gameResult ? (
                <div className="game-result">
                  <p>Player 1 played: <strong>{MOVE_NAMES[gameResult.j1Move]}</strong></p>
                  <p>Player 2 played: <strong>{MOVE_NAMES[gameResult.j2Move]}</strong></p>
                  <hr />
                  {gameResult.winner === 'tie' ? (
                    <p><strong>It's a TIE!</strong> Both players got their stake back.</p>
                  ) : gameResult.winner === 'j1' ? (
                    <>
                      {isJ1 && <p><strong>You WON!</strong></p>}
                      {isJ2 && <p><strong>You LOST.</strong></p>}
                      {!isJ1 && !isJ2 && <p><strong>Player 1 won!</strong></p>}
                    </>
                  ) : (
                    <>
                      {isJ2 && <p><strong>You WON!</strong></p>}
                      {isJ1 && <p><strong>You LOST.</strong></p>}
                      {!isJ1 && !isJ2 && <p><strong>Player 2 won!</strong></p>}
                    </>
                  )}
                </div>
              ) : (
                <div className="game-result">
                  <p>This game has been resolved.</p>
                  <p>Player 2 played: <strong>{MOVE_NAMES[gameState.c2]}</strong></p>
                  <p><em>(Game result details not available - the reveal was done from another browser/device)</em></p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {loading && <div className="loading">Processing transaction...</div>}
    </div>
  );
}

export default App;
