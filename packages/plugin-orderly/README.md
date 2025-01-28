# @elizaos/plugin-orderly

Orderly Network integration plugin for Eliza OS that enables trading on the Orderly Network decentralized exchange platform.

## Overview

This plugin provides seamless integration with [Orderly Network](https://orderly.network/), a high-performance decentralized exchange platform. It enables users to perform various trading operations including deposits, withdrawals, order creation, and position management.

## Features

- Deposit funds to Orderly Network
- Withdraw funds from Orderly Network
- Create trading orders
- Close trading positions
- Multiple network support (mainnet, testnet)
- Secure transaction signing
- Comprehensive error handling

## Installation

```bash
pnpm install @elizaos/plugin-orderly
```

## Configuration

### Environment Variables

The plugin requires the following environment variables:

```env
# Core Orderly Configuration
ORDERLY_PRIVATE_KEY=           # Your private key for signing transactions
ORDERLY_BROKER_ID=demo         # Your broker ID (default: demo)
ORDERLY_NETWORK=testnet        # Network to connect to (testnet or mainnet)

# EVM Configuration (Required)
EVM_PRIVATE_KEY=               # Your EVM wallet private key (required for all operations)

# RPC URLs for each chain you want to use
# Replace <chainname> with the uppercase chain name (e.g., ARBITRUMSEPOLIA, OPTIMISM, etc.)
ETHEREUM_PROVIDER_<chainname>=  # RPC URL for the specific chain

# Examples:
ETHEREUM_PROVIDER_ARBITRUMSEPOLIA=https://sepolia-rollup.arbitrum.io/rpc
ETHEREUM_PROVIDER_OPTIMISM=https://mainnet.optimism.io
ETHEREUM_PROVIDER_BASE=https://mainnet.base.org

# Default mainnet RPC (optional)
EVM_PROVIDER_URL=              # Default RPC URL for mainnet
```

You can generate your Orderly private key using the [Orderly Broker Registration Tool](https://orderlynetwork.github.io/broker-registration/). This tool will provide you with the necessary credentials to interact with the Orderly Network.

For each chain you specify in your character configuration, you must provide a corresponding RPC URL in the environment variables. The environment variable name should be `ETHEREUM_PROVIDER_` followed by the chain name in uppercase.

### Character Configuration

In your character configuration file (e.g., `character.json`), you need to specify which EVM chains you want to enable for the Orderly plugin. The available chains must match your `ORDERLY_NETWORK` setting:

```json
{
    "settings": {
        "chains": {
            "evm": ["arbitrumSepolia"] // Array of supported chains
        }
    }
}
```

#### Supported Chains

The following chains are supported based on the `ORDERLY_NETWORK` setting:

**Mainnet Chains** (`ORDERLY_NETWORK=mainnet`):

- `mainnet` (Ethereum)
- `arbitrum` (Arbitrum One)
- `optimism` (OP Mainnet)
- `base` (Base)
- `mantle` (Mantle)
- `sei` (Sei)
- `avalanche` (Avalanche)

**Testnet Chains** (`ORDERLY_NETWORK=testnet`):

- `sepolia` (Sepolia)
- `arbitrumSepolia` (Arbitrum Sepolia)
- `optimismSepolia` (OP Sepolia)
- `baseSepolia` (Base Sepolia)
- `mantleSepoliaTestnet` (Mantle Sepolia)
- `seiDevnet` (Sei Devnet)
- `avalancheFuji` (Avalanche Fuji)

Note: Only chains that match your `ORDERLY_NETWORK` setting will be available for use. For example, if `ORDERLY_NETWORK=testnet`, you can only use testnet chains in your character configuration.

## Usage

### Deposit Funds

```typescript
import { orderlyPlugin } from "@elizaos/plugin-orderly";

const result = await eliza.execute({
    action: "DEPOSIT_USDC",
    content: {
        amount: "100",
        token: "USDC",
    },
});
```

### Create Trading Order

```typescript
const result = await eliza.execute({
    action: "CREATE_ORDER",
    content: {
        symbol: "PERP_ETH_USDC",
        orderType: "LIMIT",
        side: "BUY",
        price: "1800",
        quantity: "1",
    },
});
```

### Close Position

```typescript
const result = await eliza.execute({
    action: "CLOSE_POSITION",
    content: {
        symbol: "PERP_ETH_USDC",
        quantity: "1",
    },
});
```

### Withdraw Funds

```typescript
const result = await eliza.execute({
    action: "WITHDRAW_USDC",
    content: {
        token: "USDC",
        amount: "50",
    },
});
```

## API Reference

### Actions

#### `DEPOSIT_USDC`

Deposits USDC funds into your Orderly Network account.

```typescript
{
  action: 'DEPOSIT_USDC',
  content: {
    token: string,    // Token symbol (e.g., "USDC")
    amount: string,   // Amount to deposit
  }
}
```

#### `CREATE_ORDER`

Creates a new trading order.

```typescript
{
  action: 'CREATE_ORDER',
  content: {
    symbol: string,     // Trading pair (e.g., "PERP_ETH_USDC")
    orderType: string,  // "LIMIT" or "MARKET"
    side: string,       // "BUY" or "SELL"
    price: string,      // Price for limit orders
    quantity: string    // Order quantity
  }
}
```

#### `CLOSE_POSITION`

Closes an existing trading position.

```typescript
{
  action: 'CLOSE_POSITION',
  content: {
    symbol: string,     // Trading pair
    quantity: string    // Position size to close
  }
}
```

#### `WITHDRAW_USDC`

Withdraws USDC funds from your Orderly Network account.

```typescript
{
  action: 'WITHDRAW_USDC',
  content: {
    token: string,    // Token symbol (e.g., "USDC")
    amount: string    // Amount to withdraw
  }
}
```

## Dependencies

- @elizaos/core: Core Eliza OS functionality
- @elizaos/plugin-evm: EVM blockchain integration
- @orderly.network/types: Orderly Network type definitions
- bignumber.js: Precise number handling
- bs58: Base58 encoding/decoding
- @noble/ed25519: ED25519 cryptographic operations

## License

This plugin is part of the Eliza project. See the main project repository for license information.
