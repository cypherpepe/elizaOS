export const mintTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested token swap:
- Input token type, eg:runes or brc20, should convert BRC20,brc20 to brc20, runes or RUNES to runes
- Input token symbol (the token being mint), eg: mint token abc
- Input token mintcap eg: "10000"
- Input token addressFundraisingCap everyone can offer eg: "10"
- Input token mintdeadline ,duration Using seconds as the unit eg: 864000


Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

\`\`\`json
{
    "tokenType": string | null,
    "inputToken": string | null,
    "mintcap": string | 1000,
    "addressFundraisingCap": string | 10,
    "mintdeadline" : number | 864000,
}
\`\`\`
`;
