# `@elizaos/plugin-btcfun`

A powerful plugin for Eliza that enables interaction with BTCFun via the Bitcoin network. This plugin provides seamless integration for minting BRC20 and Runes tokens using BTCFun's API services.

## Features

### Provider Features

- **BTCFun Provider**
    - Validates token operations for both BRC20 and Runes tokens
    - Creates and manages minting orders
    - Handles transaction broadcasting
    - Manages PSBT (Partially Signed Bitcoin Transactions)

### Action Features

- **Token Minting**
    - Supports minting of both BRC20 and Runes tokens
    - Configurable mint parameters:
        - Mint cap (maximum token supply)
        - Address fundraising cap (per-address limit)
        - Mint deadline (duration in seconds)
    - Handles Bitcoin transaction signing and broadcasting
    - Automatic PSBT creation and management

## Configuration

### Default Setup

By default, **Bitcoin mainnet** is enabled. To use it, configure the following environment variables in your `.env` file:

```env
BTC_PRIVATE_KEY_WIF=your-private-key-here
ADDRESS=your-address-here
BTCFUN_API_URL=https://api-testnet-new.btc.fun
MINTCAP=10000
MINTDEADLINE=864000
ADDRESS_FUNDRAISING_CAP=100
```

### Environment Variables

- `BTC_PRIVATE_KEY_WIF`: Your Bitcoin private key in WIF format
- `ADDRESS`: Your Bitcoin address
- `BTCFUN_API_URL`: BTCFun API endpoint URL
- `MINTCAP`: Default maximum token supply for minting
- `MINTDEADLINE`: Default duration for minting in seconds
- `ADDRESS_FUNDRAISING_CAP`: Default per-address fundraising limit

## API Reference

The plugin integrates with BTCFun's API services through the following endpoints:
- `/api/v1/import/brc20_validate` - BRC20 token validation
- `/api/v1/import/rune_validate` - Runes token validation
- `/api/v1/import/brc20_order` - BRC20 minting order creation
- `/api/v1/import/rune_order` - Runes minting order creation
- `/api/v1/import/broadcast` - Transaction broadcasting

## License

See parent project for license information.

## Contributing

Contributions are welcome! See parent project for contribution guidelines.
