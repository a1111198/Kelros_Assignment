export const RPS_BYTECODE = "0x608060405261012c600555604051604080610a73833981018060405281019080805190602001909291908051906020019092919050505034600481905550336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508160028160001916905550426006819055505050610992806100e16000396000f30060806040526004361061009d5760003560e01c63ffffffff1680630c4395b9146100a2578063294914a4146100f75780633a4b66f11461010e57806348e257cb146101395780634d03e3d21461017257806353a04b05146101a557806380985af9146101c857806389f71d531461021f578063a5ddec7c1461024a578063c37597c614610284578063c8391142146102db578063f56f48f2146102f2575b600080fd5b3480156100ae57600080fd5b506100dd600480360381019080803560ff169060200190929190803560ff16906020019092919050505061031d565b604051808215151515815260200191505060405180910390f35b34801561010357600080fd5b5061010c6103e6565b005b34801561011a57600080fd5b50610123610491565b6040518082815260200191505060405180910390f35b34801561014557600080fd5b5061014e610497565b6040518082600581111561015e57fe5b60ff16815260200191505060405180910390f35b34801561017e57600080fd5b506101876104aa565b60405180826000191660001916815260200191505060405180910390f35b6101c6600480360381019080803560ff1690602001909291905050506104b0565b005b3480156101d457600080fd5b506101dd6105a3565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b34801561022b57600080fd5b506102346105c9565b6040518082815260200191505060405180910390f35b34801561025657600080fd5b50610282600480360381019080803560ff169060200190929190803590602001909291905050506105cf565b005b34801561029057600080fd5b5061029961088b565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b3480156102e757600080fd5b506102f06108b0565b005b3480156102fe57600080fd5b50610307610960565b6040518082815260200191505060405180910390f35b600081600581111561032b57fe5b83600581111561033757fe5b141561034657600090506103e0565b6000600581111561035357fe5b83600581111561035f57fe5b141561036e57600090506103e0565b600282600581111561037c57fe5b81151561038557fe5b06600284600581111561039457fe5b81151561039d57fe5b0614156103c4578160058111156103b057fe5b8360058111156103bc57fe5b1090506103e0565b8160058111156103d057fe5b8360058111156103dc57fe5b1190505b92915050565b600060058111156103f357fe5b600360009054906101000a900460ff16600581111561040e57fe5b14151561041a57600080fd5b600554600654014211151561042e57600080fd5b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc6004549081150290604051600060405180830381858888f19350505050506000600481905550565b60045481565b600360009054906101000a900460ff1681565b60025481565b600060058111156104bd57fe5b600360009054906101000a900460ff1660058111156104d857fe5b1415156104e457600080fd5b600060058111156104f157fe5b8160058111156104fd57fe5b1415151561050a57600080fd5b6004543414151561051a57600080fd5b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614151561057657600080fd5b80600360006101000a81548160ff0219169083600581111561059457fe5b02179055504260068190555050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60065481565b600060058111156105dc57fe5b8260058111156105e857fe5b141515156105f557600080fd5b6000600581111561060257fe5b600360009054906101000a900460ff16600581111561061d57fe5b1415151561062a57600080fd5b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614151561068557600080fd5b6002546000191682826040518083600581111561069e57fe5b60ff1660f81b8152600101828152602001925050506040518091039020600019161415156106cb57600080fd5b6106e482600360009054906101000a900460ff1661031d565b1561074a576000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc6004546002029081150290604051600060405180830381858888f193505050505061087f565b610763600360009054906101000a900460ff168361031d565b156107ca57600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc6004546002029081150290604051600060405180830381858888f193505050505061087e565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc6004549081150290604051600060405180830381858888f1935050505050600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc6004549081150290604051600060405180830381858888f19350505050505b5b60006004819055505050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600060058111156108bd57fe5b600360009054906101000a900460ff1660058111156108d857fe5b141515156108e557600080fd5b60055460065401421115156108f957600080fd5b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166108fc6004546002029081150290604051600060405180830381858888f19350505050506000600481905550565b600554815600a165627a7a72305820d9d93f40d1ed9b9734d741e82c18f87b7b95c97b9db78473ea14078504239e6e0029";

export const RPS_ABI = [
    {
        "type": "constructor",
        "inputs": [
          {
            "name": "_c1Hash",
            "type": "bytes32"
          },
          {
            "name": "_j2",
            "type": "address"
          }
        ],
        "stateMutability": "payable"
      },
      {
        "type": "function",
        "name": "TIMEOUT",
        "inputs": [],
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "c1Hash",
        "inputs": [],
        "outputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "c2",
        "inputs": [],
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "j1",
        "inputs": [],
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "j1Timeout",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "j2",
        "inputs": [],
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "j2Timeout",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "lastAction",
        "inputs": [],
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "play",
        "inputs": [
          {
            "name": "_c2",
            "type": "uint8"
          }
        ],
        "outputs": [],
        "stateMutability": "payable"
      },
      {
        "type": "function",
        "name": "solve",
        "inputs": [
          {
            "name": "_c1",
            "type": "uint8"
          },
          {
            "name": "_salt",
            "type": "uint256"
          }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
      },
      {
        "type": "function",
        "name": "stake",
        "inputs": [],
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view"
      },
      {
        "type": "function",
        "name": "win",
        "inputs": [
          {
            "name": "_c1",
            "type": "uint8"
          },
          {
            "name": "_c2",
            "type": "uint8"
          }
        ],
        "outputs": [
          {
            "name": "w",
            "type": "bool"
          }
        ],
        "stateMutability": "view"
      }
];

export const MOVES = {
  Null: 0,
  Rock: 1,
  Paper: 2,
  Scissors: 3,
  Spock: 4,
  Lizard: 5
};

export const MOVE_NAMES = ['Null', 'Rock', 'Paper', 'Scissors', 'Spock', 'Lizard'];

// LocalStorage keys prefix
export const STORAGE_KEY_PREFIX = 'rpsls_game_';

// Get all stored games from localStorage
export const getStoredGames = () => {
  // Check if localStorage is available (browser environment)
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {};
  }
  
  const games = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const address = key.replace(STORAGE_KEY_PREFIX, '');
        try {
          games[address] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          console.error('Failed to parse game data for', address);
        }
      }
    }
  } catch (e) {
    console.error('localStorage access error:', e);
  }
  return games;
};

// Save game data to localStorage with contract address as key
export const saveGameData = (contractAddress, move, salt) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    const key = STORAGE_KEY_PREFIX + contractAddress.toLowerCase();
    const data = {
      move,
      salt: salt.toString(),
      createdAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save game data:', e);
  }
};

// Get game data from localStorage by contract address
export const getGameData = (contractAddress) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  
  try {
    const key = STORAGE_KEY_PREFIX + contractAddress.toLowerCase();
    const data = localStorage.getItem(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
  } catch (e) {
    console.error('Failed to get game data:', e);
  }
  return null;
};

// Remove game data from localStorage
export const removeGameData = (contractAddress) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    const key = STORAGE_KEY_PREFIX + contractAddress.toLowerCase();
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Failed to remove game data:', e);
  }
};

// Result storage prefix
export const RESULT_KEY_PREFIX = 'rpsls_result_';

// Save game result to localStorage
export const saveGameResult = (contractAddress, result) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    const key = RESULT_KEY_PREFIX + contractAddress.toLowerCase();
    localStorage.setItem(key, JSON.stringify(result));
  } catch (e) {
    console.error('Failed to save game result:', e);
  }
};

// Get game result from localStorage
export const getGameResult = (contractAddress) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }
  
  try {
    const key = RESULT_KEY_PREFIX + contractAddress.toLowerCase();
    const data = localStorage.getItem(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
  } catch (e) {
    console.error('Failed to get game result:', e);
  }
  return null;
};