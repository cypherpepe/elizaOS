import { Request, Response } from 'express';
import { google } from 'googleapis';
import { elizaLogger } from "@elizaos/core";
import { GmailConfig } from "./environment";
import { IAgentRuntime } from "@elizaos/core";
import { GoogleClient } from "./google_client";

export async function handleGoogleCallback(googleClient: GoogleClient, config: GmailConfig, req: Request, res: Response) {
    const { code } = req.query;

    if (!code) {
        elizaLogger.error("No authorization code received from Google");
        return res.status(400).send('Authorization code missing');
    }

    try {
        const oAuth2Client = new google.auth.OAuth2(
            config.GMAIL_CLIENT_ID,
            config.GMAIL_CLIENT_SECRET,
            config.GMAIL_OAUTH2_CALLBACK_URL
        );

        // Exchange code for tokens
        const { tokens } = await oAuth2Client.getToken(code as string);

        // Store tokens securely (you'll need to implement your storage solution)
        await storeTokens(googleClient.runtime, tokens);

        // Set the authenticated flag to true
        googleClient.oAuth2Client.setCredentials(tokens);
        googleClient.authenticated = true;

        elizaLogger.success("Successfully authenticated with Google");
        res.send('Authentication successful! You can close this window.');
    } catch (error) {
        elizaLogger.error("Google OAuth callback error:", error);
        res.status(500).send('Authentication failed');
    }
}

async function storeTokens(runtime: IAgentRuntime, tokens: any) {
  // Get the agentID and save the tokens in the account details
  const agentId = runtime.agentId;
  const account = await runtime.databaseAdapter.getAccountById(agentId);
  account.details = {
    ...account.details,
    credentials: tokens
  };
  const result = await runtime.databaseAdapter.updateAccount(account);
  if (!result) {
    elizaLogger.error("Failed to update account", account);
  } else {
    elizaLogger.success("Successfully saved authentication tokens");
  }
}
