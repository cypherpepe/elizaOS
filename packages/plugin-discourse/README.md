# @elizaos/plugin-discourse

Discourse plugin for Eliza OS that adds a provider which will fetch data from a target Discourse instance, such as posts. Discourse is used widely in the web3 DAO and governance community. Giving agents access to a DAO's Discourse data will enhance collaboration and decision-making within the DAO. Of course, this plugin is not limited to DAOs, it can be used outside of the web3 ecosystem.

## Overview

This plugin provides functionality to:

-   Export data from a Discourse instance in the form of a provider

## Installation

```bash
npm install @elizaos/plugin-discourse
# or
yarn add @elizaos/plugin-discourse
# or
pnpm add @elizaos/plugin-discourse
```

## Configuration

The plugin requires the following environment variables:

```bash
DISCOURSE_INSTANCE_URL=your_discourse_instance_url
```

Example:

```
DISCOURSE_INSTANCE_URL=https://gov.uniswap.org
```

## Usage

Import and register the plugin in your Eliza configuration:

```typescript
import { discoursePlugin } from "@elizaos/plugin-discourse";

export default {
    plugins: [discoursePlugin],
    // ... other configuration
};
```

## Features

### Fetch posts and summarize

Asking for a summary of the latest DAO governance activity on Discourse:

```typescript
// Example conversation
User: "What's the latest governance action?";
Assistant: "I'll check the Discourse forum and provide a summary of the latest governance activity.";
```

## API Reference

### Providers

-   `discoursePostsProvider`: Manages interactions with the Discourse API, fetching the latest posts.

## Development


### Testing

```bash
pnpm run test
```

## Dependencies

- axios: For making HTTP requests to the Discourse API.
- Other standard dependencies listed in package.json

## Future Enhancements

We welcome community feedback and contributions to help prioritize enhancements.

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## Credits

Special thanks to:
-   The Eliza community for their contributions and feedback

For more information about Discourse capabilities:

-   [Discourse Documentation](https://docs.discourse.org/)

## License

This plugin is part of the Eliza project and inherits its MIT license. See the main project repository for license information.
