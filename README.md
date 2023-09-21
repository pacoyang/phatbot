# Phatbot
Create a Telegram / Discord trading bot with [Phat Contract](https://docs.phala.network/developers/phat-contract).

## Getting Started

```bash
# copy and edit your environment variables
cp env.example .env

# install dependencies
yarn install

# run the development server
yarn dev
```

## How It Works
Phat Contract can be used to build secure and efficient Telegram bots. Here's a step-by-step guide on how developers can use Phat Contract to build a bot like the one demonstrated in the [demo](https://github.com/bs-community/telegram-bot):

**Step 1: Set Up the Phat Contract**

First, developers need to set up the Phat Contract. This involves writing the `phatbot_profile` and `phatbot_controller` contracts in Rust. The `phatbot_profile` contract is used to create EVM wallets for users and carry out various transaction operations based on these wallets. The `phatbot_controller` contract is used in conjunction with Bot to perform various automated tasks on the corresponding user's `phatbot_profile` contract.

**Step 2: Guide users to create an EVM wallet on the Website**

You need to develop a page that creates EVM wallets. Users sign through the Polkadot wallet on the page and instantiate the `phatbot_profile` contract to create an EVM wallet belonging to that wallet address based on the Telegram user's ID. The EVM wallet's private key information will be stored on the chain, and the wallet creator can view the created wallet address and private key by calling the contract method `get_evm_account_address` and `get_evm_account_sk`.

**Step 3: The management of the EVM wallet**

Guide users to assign the management right of the created `phatbot_profile` contract to the `phatbot_controller` contract address**.** Developers can specify the contract address of the manager `phatbot_controller` when the `phatbot_profile` contract is initialized, or they can guide users to sign by calling the `phatbot_profile` contract to specify the manager contract address.

**Step 4: Connect the Bot to the Phat Contract**

At this point, the Bot can manipulate the Telegram user's EVM wallet for transactions through the `phatbot_controller` contract. For example, it can perform a `mint` operation by calling the EVM wallet of the corresponding Telegram user through the contract. The following `mint` function defines a mint operation for a specific ERC721 NFT.

This is a basic framework for how to use Phat Contract to build a secure and efficient Telegram bot. By following these steps, developers can significantly enhance the security of their bots, ensuring the secrecy of the generated addresses and providing a safer trading environment for users.