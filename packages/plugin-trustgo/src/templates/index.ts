export const attestationTemplate = `When we mentioned media score, usually specify the chain info.
Your task is to extract which media score as chain (maybe one of zksync,base,scroll,manta,mantle,optimism,linea,omnichain)
Then make a structured JSON response with the chain mentioned, and sorted by mentioned time. The JSON should have this structure:
\`\`\`json
{
    "chain": string
}
\`\`\`
Given the recent messages: {{recentMessages}} process the user's request and provide your response.`;
