# Eliza Gmail Client

This package provides Gmail integration for the Eliza AI agent.

Once configured, the Gmail client will check for new emails every 30 seconds, judge on whether to respond or not, and will generate a response.
Every processed email will be automatically archived, achieving a "zero inbox" goal.

## Setup Guide

### Prerequisites

- A Gmail account (preferably a dedicated one)
- A Google Cloud Project with Gmail API enabled
- Node.js and pnpm installed

### Step 1: Setup API

1. Create a Google Cloud Project, configure a OAuth Consent Screen
2. Create credentials, create a "OAuth 2.0 Client IDs"
3. Setup the redirect URIs according to your development or production environment configuration

### Step 2: Configure Environment Variables

1. Create or edit `.env` file in your project root:

```bash
# Gmail Configuration
GMAIL_CLIENT_ID=              # From OAuth 2.0 Client IDs
GMAIL_CLIENT_SECRET=          # From OAuth 2.0 Client IDs
GMAIL_OAUTH2_PORT=            # Use any available port (3002 for example)
GMAIL_OAUTH2_CALLBACK_URL=    # Use http://localhost:<GMAIL_OAUTH2_PORT> for local development and configure it on the OAuth 2.0 Client IDs
```

### Step 3: Configure your character to use the Gmail client

In your character file, add `"clients": ["gmail"]` to the character definition.

You can also define `emailExamples` in a similar format to `messageExamples` to help the client understand your communication style.

### Step 4: Run Eliza

You should see in the logs a message like this:

```
Gmail needs authentication - click on this URL to authenticate: https://accounts.google.com/...
```

Once you authenticate, you should get redirect to the `GMAIL_OAUTH2_CALLBACK_URL` you configured in the OAuth 2.0 Client IDs and see the message: `Authentication successful! You can close this window.`

From this point on, the Gmail client will check for new emails every 30 seconds.

The auth and refresh tokens are stored in the database in the accounts table, in the `details` JSON column.

The client will automatically try to refresh the tokens if they are expired.

### Security Notes

- Never commit your `.env` file or tokens to version control
- Rotate your tokens if they're ever exposed

## Development

### Local Testing

You can use a http://localhost:<GMAIL_OAUTH2_PORT> for local development and configure it on the OAuth 2.0 Client IDs without the need of ngrok or any other tunneling service.
