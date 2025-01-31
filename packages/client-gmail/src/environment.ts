import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const gmailEnvSchema = z.object({
  GMAIL_CLIENT_ID: z
        .string()
        .min(1, "Gmail client ID is required"),
  GMAIL_CLIENT_SECRET: z.string().min(1, "Gmail client secret is required"),
  GMAIL_OAUTH2_PORT: z.number().int().positive("Gmail Oauth2 port must be a positive integer"),
  GMAIL_OAUTH2_CALLBACK_URL: z.string().min(1, "Gmail Oauth2 callback url is required"),
});

export type GmailConfig = z.infer<typeof gmailEnvSchema>;

export async function validateGmailConfig(
    runtime: IAgentRuntime
): Promise<GmailConfig> {
    try {
        const config = {
          GMAIL_CLIENT_ID:
            runtime.getSetting("GMAIL_CLIENT_ID") ||
            process.env.GMAIL_CLIENT_ID,
          GMAIL_CLIENT_SECRET:
            runtime.getSetting("GMAIL_CLIENT_SECRET") ||
            process.env.GMAIL_CLIENT_SECRET,
          GMAIL_OAUTH2_PORT:
            parseInt(runtime.getSetting("GMAIL_OAUTH2_PORT") ||
            process.env.GMAIL_OAUTH2_PORT || "3002"),
          GMAIL_OAUTH2_CALLBACK_URL:
            runtime.getSetting("GMAIL_OAUTH2_CALLBACK_URL") ||
            process.env.GMAIL_OAUTH2_CALLBACK_URL,
        };

        return gmailEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Gmail configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
