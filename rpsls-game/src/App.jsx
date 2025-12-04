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
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  hasRegisteredCredential,
  registerWebAuthnCredential,
  authenticateAndDeriveKey,
  encryptGameData,
  decryptGameData,
  removeStoredCredential,
  isPrfSupported,
  checkPrfCapability
} from './webAuthnCrypto';
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
  const [revealData, setRevealData] = useState({ 
    move: MOVES.Rock, 
    salt: '', 
    isEncrypted: false,
    encryptedData: null 
  });
  
  // WebAuthn biometric encryption state
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [useEncryption, setUseEncryption] = useState(true); // Toggle for encryption
  const [prfSupported, setPrfSupported] = useState(false); // PRF extension support (after registration)
  const [prfCapable, setPrfCapable] = useState(false); // Browser PRF capability (before registration)
  const [encryptionPin, setEncryptionPin] = useState(''); // PIN for non-PRF browsers

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
    
    // Initialize WebAuthn support check
    const initWebAuthn = async () => {
      const supported = isWebAuthnSupported();
      setWebAuthnSupported(supported);
      
      if (supported) {
        const biometricAvail = await isPlatformAuthenticatorAvailable();
        setBiometricAvailable(biometricAvail);
        setHasCredential(hasRegisteredCredential());
        setPrfSupported(isPrfSupported());
        
        // Check if browser is likely to support PRF (before registration)
        const prfCap = await checkPrfCapability();
        setPrfCapable(prfCap);
      }
    };
    initWebAuthn();
    
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

  // WebAuthn biometric registration
  const registerBiometric = async () => {
    try {
      setError('');
      setLoading(true);
      
      if (!webAuthnSupported) {
        throw new Error('WebAuthn is not supported in this browser');
      }
      
      if (!biometricAvailable) {
        throw new Error('Platform biometric authenticator is not available');
      }
      
      // Try registration - PIN may be required if PRF not supported
      const result = await registerWebAuthnCredential('RPSLS Player', encryptionPin);
      
      // Check if PIN is needed (PRF was predicted to work but didn't)
      if (result.needsPin) {
        // PRF was not actually supported - update capability state and show message
        setPrfCapable(false);
        setError(result.message);
        return;
      }
      
      setHasCredential(true);
      setPrfSupported(result.prfSupported);
      
      if (result.prfSupported) {
        alert('Biometric credential registered with PRF support! Your game data will be fully protected by biometric.');
      } else {
        alert('Biometric credential registered! Note: Your browser requires a PIN along with biometric for encryption.');
      }
      
    } catch (err) {
      console.error('Biometric registration failed:', err);
      setError(err.message || 'Failed to register biometric');
    } finally {
      setLoading(false);
    }
  };

  // Remove biometric credential
  const removeBiometric = () => {
    removeStoredCredential();
    setHasCredential(false);
    alert('Biometric credential removed. Game data will no longer be encrypted.');
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
      
      // Save game data - encrypted if biometric is available and enabled
      if (useEncryption && hasCredential) {
        try {
          // Authenticate with biometric and encrypt the salt
          // Pass PIN if PRF not supported
          const key = await authenticateAndDeriveKey(prfSupported ? '' : encryptionPin);
          const encryptedData = await encryptGameData(key, createFormData.move, salt.toString());
          saveGameData(deployedAddress, createFormData.move, salt.toString(), encryptedData);
          console.log('Game data saved with biometric encryption');
        } catch (encryptErr) {
          console.error('Encryption failed, falling back to unencrypted storage:', encryptErr);
          // Fallback to unencrypted storage if encryption fails
          saveGameData(deployedAddress, createFormData.move, salt.toString());
        }
      } else {
        // No encryption - save directly
        saveGameData(deployedAddress, createFormData.move, salt.toString());
      }
      
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
      
      // Load saved game data - but DON'T decrypt here
      // Decryption only happens when actually revealing the move
      const savedGame = getGameData(address);
      if (savedGame) {
        if (savedGame.isEncrypted && savedGame.encryptedData) {
          // Mark that we have encrypted data, but don't decrypt yet
          // The actual decryption happens in revealMove()
          setRevealData({
            move: MOVES.Rock, // Placeholder - will be decrypted when needed
            salt: '',
            isEncrypted: true,
            encryptedData: savedGame.encryptedData
          });
        } else {
          // Unencrypted data - can load directly
          setRevealData({
            move: savedGame.move,
            salt: savedGame.salt,
            isEncrypted: false
          });
        }
      } else {
        setRevealData({ move: MOVES.Rock, salt: '', isEncrypted: false });
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
      
      let moveToReveal = revealData.move;
      let saltToReveal = revealData.salt;
      
      // If data is encrypted, decrypt it now with biometric
      if (revealData.isEncrypted && revealData.encryptedData) {
        try {
          // Pass PIN if PRF not supported
          const key = await authenticateAndDeriveKey(prfSupported ? '' : encryptionPin);
          const decryptedData = await decryptGameData(key, revealData.encryptedData);
          moveToReveal = decryptedData.move;
          saltToReveal = decryptedData.salt;
          console.log('Game data decrypted for reveal');
        } catch (decryptErr) {
          throw new Error('Biometric authentication failed. Please try again.' + 
            (!prfSupported ? ' Make sure to enter the correct PIN.' : ''));
        }
      }
      
      if (!saltToReveal) {
        throw new Error('Salt is required to reveal');
      }
      
      const contract = new ethers.Contract(contractAddress, RPS_ABI, signer);
      
      // Check if game is already resolved (stake = 0) and. No zero amount issue as I am checking from frontend. 
      const currentStake = await contract.stake();
      if (currentStake.eq(0)) {
        throw new Error('Game is already resolved. The stake is 0 - either someone already revealed or a timeout was claimed.');
      }
      
   
      const j2Move = gameState.c2;
      const j1Move = moveToReveal;
      
      const tx = await contract.solve(moveToReveal, saltToReveal);
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

      {/* WebAuthn Biometric Security Section */}
      {webAuthnSupported && biometricAvailable && (
        <div className="section">
          <h2> Biometric Security</h2>
          <p className="info-text">
            Protect your game secrets (salt) with biometric encryption using WebAuthn.
          </p>
          
          {!hasCredential ? (
            <div>
              <p>No biometric credential registered. Your game data will be stored unencrypted.</p>
              
              {/* Show PRF capability status */}
              {prfCapable ? (
                <p className="success-text">Your browser may support PRF - biometric-only encryption may be available!</p>
              ) : (
                <p className="warning-text">Your browser doesn't support PRF extension. PIN required for security.</p>
              )}
              
              {/* Always show PIN input as fallback - PRF capability is just a prediction */}
              <div className="form" style={{ marginBottom: '15px' }}>
                <div>
                  <label>Security PIN {prfCapable ? '(optional - backup if PRF fails)' : '(required)'}:</label>
                  <input 
                    type="password"
                    value={encryptionPin}
                    onChange={(e) => setEncryptionPin(e.target.value)}
                    placeholder="Enter a PIN (min 4 characters)"
                    minLength={4}
                  />
                  <p className="info-text small">
                    {prfCapable 
                      ? 'Provide a PIN as backup. If your device fully supports PRF, it won\'t be needed.'
                      : 'This PIN will be required along with biometric for encryption/decryption.'}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={registerBiometric} 
                disabled={loading || (!prfCapable && encryptionPin.length < 4)}
                className="biometric-btn"
              >
                {loading ? 'Registering...' : '🔒 Register Biometric'}
              </button>
            </div>
          ) : (
            <div>
              <p className="success-text">✅ Biometric credential registered</p>
              {prfSupported ? (
                <p className="info-text">🎉 PRF enabled - biometric-only encryption active!</p>
              ) : (
                <div className="form" style={{ marginTop: '10px' }}>
                  <div>
                    <label>Security PIN (required for encryption/decryption):</label>
                    <input 
                      type="password"
                      value={encryptionPin}
                      onChange={(e) => setEncryptionPin(e.target.value)}
                      placeholder="Enter your PIN"
                    />
                  </div>
                </div>
              )}
              <div className="encryption-toggle">
                <label>
                  <input 
                    type="checkbox" 
                    checked={useEncryption} 
                    onChange={(e) => setUseEncryption(e.target.checked)}
                  />
                  Encrypt game data with biometric
                </label>
              </div>
              <button 
                onClick={removeBiometric} 
                className="danger-btn"
                style={{ marginTop: '10px' }}
              >
                Remove Biometric Credential
              </button>
            </div>
          )}
          
          <p className="info-text small">
            {!hasCredential 
              ? 'We\'ll check if your device supports PRF during registration. If not, PIN will be required.'
              : prfSupported 
                ? 'Your game data is protected by biometric authentication only.'
                : 'You\'ll need biometric + PIN to create games and reveal moves.'}
          </p>
        </div>
      )}
      
      {webAuthnSupported && !biometricAvailable && (
        <div className="section">
          <h2>Biometric Security</h2>
          <p className="warning-text">
            Platform biometric authenticator not available. Game data will be stored unencrypted.
          </p>
        </div>
      )}

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
                      {revealData.isEncrypted ? (
                        <>
                          <p>Your game data is <span className="encrypted-badge">Encrypted</span></p>
                          <p className="info-text">Biometric authentication will be required when you click reveal.</p>
                          <div className="form">
                            <button onClick={revealMove} disabled={loading}>
                              {loading ? 'Revealing...' : 'Authenticate & Reveal'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p>Your move: <strong>{MOVE_NAMES[revealData.move]}</strong></p>
                          <div className="form">
                            <button onClick={revealMove} disabled={loading || !revealData.salt}>
                              {loading ? 'Revealing...' : 'Reveal & Resolve Game'}
                            </button>
                          </div>
                        </>
                      )}
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
