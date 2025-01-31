export const transferTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested transfer:
- Chain to execute on: Must be one of ["fuse", "base", ...] (like in viem/chains)
- Amount to transfer: Must be a string representing the amount in FUSE (only number without coin symbol, e.g., "0.1")
- Recipient address: Must be a valid Fuse address starting with "0x"
- Token symbol or address (if not native token): Optional, leave as null for FUSE transfers

Respond with a JSON markdown block containing only the extracted values. All fields except 'token' are required:

\`\`\`json
{
    "fromChain": SUPPORTED_CHAINS,
    "amount": string,
    "toAddress": string,
    "token": string | null
}
\`\`\`
`;

export const createTokenTemplate = `Respond with a JSON markdown block containing only the extracted values.

If the user did not provide enough details, respond with what you can. The following fields are required: Name, Symbol, Token Owner, and From Chain.

Example response for a new token:
\`\`\`json
{
    "name": "Test Token",
    "symbol": "TEST",
    "tokenOwner": "0x1234567890abcdef1234567890abcdef12345678",
    "fromChain": SUPPORTED_CHAINS
}
\`\`\`

## Recent Messages

{{recentMessages}}

Given the recent messages, extract the following information about the requested token creation:
- Name
- Symbol
- Token Owner (must be a valid address starting with "0x")
- From Chain (must be one of ["fuse", "base", ...] like in viem/chains)

Respond with a JSON markdown block containing only the extracted values.`;
