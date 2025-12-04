# Rock Paper Scissors Lizard Spock - Exercise D

This project is an implementation of the Rock Paper Scissors Lizard Spock game for Exercise D of the assignment. It includes both a smart contract implementation and a frontend interface for playing the game on the Ethereum blockchain.

## Project Structure

This repository contains two main folders:

1. **rpsls_contract** - Foundry testing environment for smart contract setup and understanding and testing
2. **rpsls-game** - Frontend application built with React and Vite

### rpsls_contract Folder

This folder uses Foundry for testing and verifying the smart contract behavior and interactions. It allows you to:
- Test smart contract logic locally
- Verify game mechanics and edge cases
- Use Anvil (local Ethereum node) for rapid development
- Deploy and interact with contracts in a controlled environment

### rpsls-game Folder

This folder contains the actual frontend application that users interact with. It provides a web interface to:
- Connect MetaMask wallet
- Create and join games
- Make moves and reveal results
- Track multiple ongoing games


## Design Decisions and Architecture

### Local Hashing for Commitment

The hash calculation cannot be done on-chain before contract deployment. Instead, the frontend uses the ethers.js library to compute the commitment hash locally. This keeps the first player's move secret until the reveal phase while allowing the contract to be deployed with the commitment.

### Local Storage for Game State

Game data (including the salt and move) is stored in the browser's local storage using the deployed contract address as the key. This allows players to:
- Participate in multiple games simultaneously
- Track different games with different opponents
- Resume games after closing the browser

#### Security Philosophy: Why Most Secure Solutions Require 4 Steps

The fundamental challenge with commit-reveal schemes is protecting the salt (secret) between game creation and reveal. Any truly secure solution typically requires 4 user interactions instead of 2. Here's an analysis of various approaches considered:

**Alternative Approaches Evaluated:**

1. **Password-Based Encryption**
   - User enters a password to derive a key, encrypt the salt, and store it
   - At reveal time, user re-enters the password to decrypt the salt
   - *Trade-off*: Turns the 2-step process into 4 steps (password → create → play → password → reveal)

2. **Key File Download/Upload**
   - User downloads a JSON or .pk file containing the key at game creation
   - User uploads the same file at reveal time
   - *Trade-off*: Adds 2 steps (download key, upload key) and requires file management

3. **Web3 Wallet Signatures**
   - Sign a message to generate the salt at creation
   - Sign again at reveal to regenerate the same salt
   - *Trade-off*: 4-step process (sign → deploy → play → sign → reveal) with additional MetaMask popups

4. **Server-Side Salt Storage**
   - Generate and store salt on a backend server, return a token ID to frontend
   - Frontend uses token to retrieve salt at reveal time
   - *Trade-off*: Introduces centralization risks. If auth is required to retrieve salt, we're back to the same 4-step problem. If no auth, anyone with the token can retrieve the salt.

**The Trust Context Consideration:**

An important observation is that you're inviting a specific person to play (you start the game with their address). This means:
- No random person can join your game
- There's already an implicit trust relationship with your opponent
- The threat model is primarily about protecting against local storage access attacks

#### Advanced Security: WebAuthn with PRF Extension

For users who want maximum security, this implementation supports **biometric-based encryption using WebAuthn with the PRF (Pseudo Random Function) extension**.

**Why Standard WebAuthn Doesn't Work Directly:**

Standard WebAuthn always derives a new key even with the same challenge, making it unsuitable for encryption/decryption workflows. We cannot simply:
- Derive a key from biometrics at creation
- Derive the same key at reveal time

Even attempting to use a master key encrypted with credential ID fails because both the credential ID and encrypted key would be in browser storage—the very thing we're trying to protect against.

**The Solution: WebAuthn PRF Extension**

The PRF extension solves this by providing a **deterministic secret tied to biometric authentication**. The flow:

1. **Registration Phase:**
   - Biometric registration occurs
   - Random master key is generated
   - WebAuthn + PRF extension is invoked
   - PRF output (not PRF salt) acts as a password to encrypt the master key

2. **Game Creation:**
   - Master key encrypts the game salt
   - Encrypted salt is stored in local storage
   - PRF salt is stored for later use

3. **Reveal Phase:**
   - User authenticates with biometrics
   - PRF extension with stored PRF salt regenerates the same password
   - Password decrypts the master key
   - Master key decrypts the game salt
   - Salt is sent to smart contract for reveal

**Security Guarantee:** This approach is truly secure as long as the system hardware where the authenticator stores its data is not compromised. The secret is derived deterministically from biometrics and never stored in accessible browser storage.

#### Fallback: PIN-Based Encryption

Since WebAuthn PRF is not supported in all browsers, a PIN-based fallback is implemented:

- User sets a 4-digit PIN at game creation
- PIN is used to derive an encryption key (PBKDF2 with 100,000 iterations)
- Encrypted salt is stored in local storage
- At reveal, user re-enters PIN to decrypt

**Security Analysis of PIN Fallback:**
- 4-digit PIN = 10,000 possible combinations
- 100,000 PBKDF2 iterations ≈ 0.1 seconds per attempt
- Brute force time: 10,000 × 0.1s = 1,000 seconds ≈ **16.67 minutes**
- Game timeout: **5 minutes**

Since the timeout (5 min) is significantly less than the brute force time (17 min), the PIN approach remains secure for the game's duration.

#### Current Implementation Choice

The current implementation uses **WebAuthn PRF where supported, with PIN fallback for other browsers**. This provides:
- Strong security through biometric/PIN protection
- Protection against local storage read attacks
- Reasonable UX with minimal additional steps
- Hardware-backed security when available

### Timeout Handling

The smart contract includes a 5-minute timeout mechanism. Some interesting considerations:

- **Timeout Function Access**: The contract allows anyone to call the timeout function, not just Player 1. Although funds remain safe regardless of who calls it. However, ideally only Player 1 should decide how much time to give Player 2 to respond. Even though no one gains an advantage by calling the timeout (and actually wastes gas doing so), the decision of when to enforce the timeout should belong to Player 1 alone. The frontend addresses this by providing clear timer information so Player 1 can manage the timeout appropriately.

- **Frontend Timing Buffer**: A 12-second margin is added to timeout calculations in the frontend. This prevents situations where the timer expires in the application but the blockchain timestamp hasn't caught up yet, avoiding transaction reverts.

### Zero-Value Games

The smart contract technically allows games to be created with zero stake. While this means players could play for free forever from the contract's perspective, the frontend includes validation to prevent creating games without a stake amount for better user experience.

### Stake Amount Check Before Reveal

An interesting contract behavior: even after a timeout, player moves are not reset, only the stake amount is set to zero. This means Player 2 could call the timeout function and get all the money, but Player 1 could still call reveal and "win" virtually without getting any funds.

The frontend handles this by checking if the stake amount is non-zero before allowing the reveal function to be called, preventing confusing situations where a player wins the game but receives no funds.

### Address Validation

The frontend includes several validation checks:
- Checksum validation for opponent addresses
- Prevents players from entering their own connected wallet address (no point playing against yourself)
- Ensures addresses are properly formatted before contract deployment

### Input Validation

Several checks are in place for better user experience:
- Only numeric values allowed in stake amount field
- Non-zero stake amounts required
- Scientific notation (like e10) is allowed for flexibility
- Mouse wheel scrolling disabled on number inputs to prevent accidental changes

### Timeout Updates

Timeout state is updated when the "Refresh Player 2 State" function is called, as the application does not use polling. Both players can check timeout status by refreshing the game state.

## Deployment and Setup

### Prerequisites

- Node.js and npm installed
- Foundry installed (for contract testing)
- MetaMask browser extension
- Sepolia testnet ETH (for deployment)

### Contract Testing with Foundry

1. Navigate to the contract folder:
   ```bash
   cd rpsls_contract
   ```

2. Install dependencies:
   ```bash
   forge install
   ```

3. Start a local Anvil node:
   ```bash
   anvil
   ```

4. Deploy and test contracts locally:
   ```bash
   forge create src/RPS.sol:RPS --private-key=YOUR_PRIVATE_KEY --constructor-args HASH PLAYER2_ADDRESS --value STAKE_AMOUNT
   ```

### Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd rpsls-game
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local development URL (usually http://localhost:5173)

### Playing the Game

1. **Connect Wallet**: Click the connect button and approve MetaMask connection
2. **Select Network**: Ensure you are connected to Sepolia testnet (the app will prompt if not)
3. **Security Setup (First Time Only)**:
   - If your browser supports WebAuthn PRF, you'll be prompted for biometric registration
   - If not supported, you'll set up a 4-digit PIN for salt encryption
   - This step only happens once per browser/device
4. **Create Game (Player 1)**:
   - Enter the opponent's Ethereum address
   - Choose your move (Rock, Paper, Scissors, Lizard, or Spock)
   - Enter the stake amount in ETH
   - **If using WebAuthn PRF**: Authenticate with biometrics to encrypt your move's salt
   - **If using PIN fallback**: Enter your PIN to encrypt the salt
   - Click "Create Game" to deploy the contract
   - Save the contract address to share with your opponent
5. **Join Game (Player 2)**:
   - Enter the contract address provided by Player 1
   - The app loads game details (stake amount, timeout status)
   - Choose your move
   - Send the matching stake amount with your transaction
6. **Reveal (Player 1)**:
   - Load the game using the contract address
   - **If using WebAuthn PRF**: Authenticate with biometrics to decrypt your salt
   - **If using PIN fallback**: Enter your PIN to decrypt the salt
   - Click reveal to show your original move
   - The smart contract determines the winner and distributes funds automatically

### Security Modes

The app automatically detects browser capabilities and uses the most secure available option:

| Mode | Security Level | User Experience |
|------|---------------|-----------------|
| **WebAuthn PRF** | Highest - Hardware-backed biometric encryption | Biometric prompt at create & reveal |
| **PIN Fallback** | High - PBKDF2 encrypted (secure within 5-min timeout) | 4-digit PIN at create & reveal |

### Loading Existing Games

You can load previously created or joined games by entering the contract address in the "Load Existing Game" field. The app will retrieve the game state and allow you to continue playing.

**Note**: When loading a game you created (as Player 1), you'll need to authenticate (biometric or PIN) to decrypt your stored salt for the reveal phase.

## Technology Stack

- **Smart Contracts**: Solidity 0.4.26
- **Testing Framework**: Foundry/Forge
- **Frontend**: React with Vite
- **Web3 Library**: ethers.js v6
- **Wallet Integration**: MetaMask

## Network Support

Currently, the application is designed to work on the Sepolia testnet. Single-chain support was chosen to simplify the initial implementation and testing process.

## Notes

- The game follows the original smart contract specification by Clément Lesaege
- All game logic is enforced on-chain for transparency and fairness
- The frontend serves as an interface and includes additional checks for improved user experience
- Multiple simultaneous games are supported through local storage management


