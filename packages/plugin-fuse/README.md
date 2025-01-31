# `@elizaos/plugin-fuse`

This plugin provides actions and providers for interacting with the **Fuse** blockchain.

## Configuration

### Default Setup

By default, **Fuse** is enabled. To use it, simply add your private key to the .env file:

```
FUSE_PRIVATE_KEY=your-private-key-here
```

### Custom RPC URLs

By default, the RPC URL is inferred from the viem/chains configuration. To use a custom RPC URL for a specific chain, add the following to your .env file:

```
ETHEREUM_PROVIDER_<CHAIN_NAME>=https://your-custom-rpc-url
```

**Example:**
```
ETHEREUM_PROVIDER_FUSE=https://rpc.fuse.io
```

## Providers

The **Wallet Provider** initializes with Fuse and:
* Provides the **context** of the currently connected address and its balance
* Creates **Public** and **Wallet clients** to interact with the supported chain

## Actions

The createToken and transfer actions are independent and serve different purposes. createToken is used for deploying ERC20 tokens, while transfer facilitates token transfers between addresses on the Fuse blockchain.

### CreateToken (Token Deployment)

The createToken action allows users to deploy an ERC20 token using the **ERC20Factory** contract. This action is separate from transfer and does not interact with existing tokens.

#### Example Usage

A user request to create a token:

Create a token named MyToken with the symbol MTK with Token owner 0x1234567890abcdef1234567890abcdef12345678 on Fuse.

This translates to the following JSON payload:

```json
{
  "name": "MyToken",
  "symbol": "MTK",
  "tokenOwner": "0x1234567890abcdef1234567890abcdef12345678",
  "fromChain": "fuse"
}
```

#### Features

* Uses the ERC20Factory contract
* Deploys a new ERC20 token
* Returns in the event the token contract address after deployment

### Transfer

The transfer action enables the transfer of tokens from one address to another on the **Fuse** blockchain.

#### Parameters

* **Amount**
* **Chain**
* **Recipient Address**

#### Example Usage

Transfer 1 FUSE to 0xRecipient on Fuse.

## Contract Details

### CreateToken Contract Details

The createToken action interacts with the **ERC20Factory** contract to deploy ERC20 tokens.

#### ERC20Factory.sol
* Deploys new ERC20 tokens
* Emits a TokenCreated event
* Allows querying the number of created tokens

#### CustomToken.sol
* ERC20 token with an initial supply minted to the token owner
* Implements OpenZeppelin's **ERC20** and **Ownable** modules

## Running Tests

This plugin includes a test suite using **vitest** to ensure reliability and functionality. The tests cover core features with unit tests, including token creation via createToken and token transfers via transfer.

Navigate to the plugin-fuse directory and run:

```bash
pnpm test
```

## Contribution

* All new features should be covered with tests
* Follow best practices and ensure the code passes linting with:

```bash
pnpm lint
```

## License

This project is licensed under **MIT**.