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

The salt is stored without encryption in local storage. While encryption could provide additional security, this implementation prioritizes user experience over additional security layers. The game timeout is only 5 minutes, creating a short window of vulnerability.

An alternative approach would be to use Web3 message signing, where the user signs a message to generate the salt at game creation and signs again during the reveal phase. However, the commit-reveal scheme already requires two user interactions (create and reveal). Adding signature requests would turn this into a four-step process: sign for salt, deploy contract, make move as Player 2, then sign again to reveal. For a casual game with small stakes and a 5-minute timeout, this added friction was considered excessive. The current implementation accepts the minor security trade-off in favor of a smoother user experience.

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
3. **Create Game (Player 1)**:
   - Enter the opponent's Ethereum address
   - Choose your move
   - Enter the stake amount in ETH
   - Click "Create Game" to deploy the contract
   - Save the contract address to share with your opponent
4. **Join Game (Player 2)**:
   - Enter the contract address provided by Player 1
   - Choose your move
   - Send the matching stake amount
5. **Reveal (Player 1)**:
   - Click reveal to show your original move
   - The smart contract determines the winner
   - Funds are distributed automatically

### Loading Existing Games

You can load previously created or joined games by entering the contract address in the "Load Existing Game" field. The app will retrieve the game state and allow you to continue playing.

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


