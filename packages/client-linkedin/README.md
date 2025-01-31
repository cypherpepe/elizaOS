# LinkedIn Client

A Node.js client for automated LinkedIn post publishing with configurable intervals and content generation.

## Features

- Automated LinkedIn post publishing
- AI-powered content generation
- Configurable posting intervals
- Dry run mode for testing
- Error handling and logging
- Token-based authentication

## Quick Start

1. Set up your environment variables:

```
LINKEDIN_ACCESS_TOKEN=your_access_token
LINKEDIN_POST_INTERVAL_MIN=60 # minimum interval in minutes (default: 60)
LINKEDIN_POST_INTERVAL_MAX=120 # maximum interval in minutes (default: 120)
LINKEDIN_API_URL=https://api.linkedin.com # optional, defaults to https://api.linkedin.com
LINKEDIN_DRY_RUN=false # optional, defaults to false
```

2. Run eliza agent with character that uses Linkedin client and topics that you want to post about. Example:

```
{
    ...,
    "clients": ["linkedin"],
    ...,
    "topics": [
        "Applications of Artificial Intelligence in Blockchain Development",
        "The Role of Decentralization in AI Model Training",
        "Smart Contracts and AI Integration: Trends and Opportunities",
        "Blockchain's Impact on AI Model Transparency and Explainability",
        "AI and Blockchain for Data Security and Privacy Protection",
        "Ethical Considerations in the Use of AI and Blockchain Together",
        "AI-Driven Blockchain Solutions for Financial Services",
        "Decentralized Autonomous Organizations (DAOs) Powered by AI",
        "Leveraging Blockchain for Verifiable AI Model Provenance",
    ],
}
```

## Configuration Options

| Variable                   | Description                              | Default                  | Required |
| -------------------------- | ---------------------------------------- | ------------------------ | -------- |
| LINKEDIN_ACCESS_TOKEN      | LinkedIn API access token                | -                        | Yes      |
| LINKEDIN_POST_INTERVAL_MIN | Minimum interval between posts (minutes) | 60                       | No       |
| LINKEDIN_POST_INTERVAL_MAX | Maximum interval between posts (minutes) | 120                      | No       |
| LINKEDIN_API_URL           | LinkedIn API URL                         | https://api.linkedin.com | No       |
| LINKEDIN_DRY_RUN           | Enable dry run mode (no actual posting)  | false                    | No       |

## Features in Detail

### Automated Post Publishing

The client automatically publishes posts to LinkedIn at random intervals between `LINKEDIN_POST_INTERVAL_MIN` and `LINKEDIN_POST_INTERVAL_MAX`. This randomization helps maintain a natural posting pattern.

### Content Generation

Posts are generated using AI, following these guidelines:

- Technical accuracy
- Professional tone
- Knowledge sharing focus
- 800-1200 characters length
- Relevant technical hashtags
- No personal stories or company-specific details

### Dry Run Mode

Enable `LINKEDIN_DRY_RUN=true` to test the client without actually publishing posts to LinkedIn.

### Error Handling

The client includes comprehensive error handling for:

- API errors
- Authentication issues
- Rate limiting
- Network problems

## Authentication

### How to Generate an Access Token Manually Using the LinkedIn Developer Portal

The LinkedIn access token is essential for enabling API calls on behalf of a user. It allows your application to interact with LinkedIn's API to perform actions such as posting updates, accessing user profiles, and managing LinkedIn pages. The following instructions will guide you through the process of generating this token.

#### Step 1: Create a New Application

1. Navigate to the [LinkedIn Developer Portal](https://developer.linkedin.com/).
2. Click the **Create app** button.
3. Fill in the **App name** field.
4. Specify a **LinkedIn Page** (either select an existing page or create a new one).
5. Upload a **logo** from your local device.
6. Agree to the terms and conditions by selecting **I have read and agree to these terms**.
7. Complete the process by clicking the **Create app** button.

#### Step 2: Configure Your Linkedin Application

1. Navigate to the **Products** tab in your application.
2. Under **OAuth Permissions**, select the following scopes:
    - **Sign In with LinkedIn using OpenID Connect**
    - **Share on LinkedIn**

#### Step 3: Generate an Access Token

1. Open the **Auth** tab in your application.
2. Click on the **OAuth 2.0 tools** link (you can also navigate via **Docs and tools > OAuth Token Tools** in the navigation bar).
3. Press **Create token** to start the process.
4. Ensure the **OAuth flow** is set to **Member authorization code (3-legged)**.
5. Under **Select scopes**, check the boxes for:
    - `openid`
    - `profile`
    - `w_member_social`
6. Click the **Request access token** button.
7. Log in using your LinkedIn credentials and click **Sign In**.
8. Grant your application the requested permissions by selecting **Allow**.
9. After successful authorization, your **access token** will be displayed and is ready for use.

#### Resolving Common Issues

If you encounter the error:

> "We can't verify the authenticity of your request because the state parameter was modified."

This may indicate that your browser is blocking the request. To resolve:

- Disable all browser extensions temporarily.
- Try generating the token in another browser (e.g., Google Chrome).

Important! Be aware that some browsers, such as Brave, have built-in protections that might block token generation.

#### Important Notes

- The access token is valid for **2 months**. After expiration, you must repeat the steps above to generate a new token.
- If the token does not have all the required permissions, regenerate it and ensure the correct scopes are selected.
- Generating the access token automatically updates the **Authorized redirect URLs for your app** field in your application.

#### What Is a Redirect URL?

A **redirect URL** is the URI where users are sent after authorization. It must match one of the redirect URLs defined in your application configuration.

For more detailed information, visit Microsoft's official documentation on the [Authorization Code Flow (3-legged OAuth)](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow?tabs=HTTPS1).
