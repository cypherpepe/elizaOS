import { elizaLogger, IAgentRuntime } from "@elizaos/core";
import { validateGmailConfig } from "./environment";
import { google } from "googleapis";
import type { Auth } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send'
]

import express, { Request } from "express";
import { handleGoogleCallback } from "./oauth2Callback";

export class GoogleClient {
  runtime: IAgentRuntime;
  gmailClientId: string;
  gmailClientSecret: string;
  oAuth2Client: Auth.OAuth2Client;
  authenticated: boolean;

  private server: express.Application;
  private httpServer: ReturnType<express.Application['listen']>;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.initialize();
  }

  private async initialize() {
    const config = await validateGmailConfig(this.runtime);
    this.oAuth2Client = new google.auth.OAuth2(config.GMAIL_CLIENT_ID, config.GMAIL_CLIENT_SECRET, config.GMAIL_OAUTH2_CALLBACK_URL)

    // Check if we have credentials saved
    const agentId = this.runtime.agentId;
    const account = await this.runtime.databaseAdapter.getAccountById(agentId);
    const credentials = account.details?.credentials;

    this.authenticated = false;
    if (credentials) {
      this.oAuth2Client.setCredentials(credentials);

      // Check if tokens are expired or will expire soon
      const tokenInfo = this.oAuth2Client.credentials;
      const isExpired = !tokenInfo.expiry_date || tokenInfo.expiry_date <= Date.now();

      if (isExpired) {
        try {
          // This will automatically refresh the token if possible
          const { credentials: newCredentials } = await this.oAuth2Client.refreshAccessToken();

          const account = await this.runtime.databaseAdapter.getAccountById(agentId);
          account.details = {
            ...account.details,
            credentials: newCredentials
          };
          await this.runtime.databaseAdapter.updateAccount(account);
          this.authenticated = true;
          elizaLogger.info("Gmail OAuth tokens refreshed successfully");
        } catch (error) {
          elizaLogger.error("Failed to refresh OAuth tokens:", error);
        }
      }
      this.authenticated = true;
    }

    if (!this.authenticated) {
      const authorizeUrl = this.oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
      })

      elizaLogger.success("Gmail needs authentication - click on this URL to authenticate: ", authorizeUrl);
    }

    // Start server
    this.server = express();
    this.server.get('/oauth2/callback', (req, res) => handleGoogleCallback(this, config, req, res));
    this.httpServer = this.server.listen(config.GMAIL_OAUTH2_PORT, () => {
      elizaLogger.success("Gmail server listening on port ", config.GMAIL_OAUTH2_PORT);
    });

  }

  async close() {
    this.httpServer.close();
  }
}
