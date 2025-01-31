import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const discourseEnvSchema = z.object({
    DISCOURSE_INSTANCE_URL: z
        .string()
        .min(1, "Discourse instance URL is required"),
});

export type DiscourseConfig = z.infer<typeof discourseEnvSchema>;

export async function validateDiscourseConfig(
    runtime: IAgentRuntime
): Promise<DiscourseConfig> {
    try {
        const config = {
            DISCOURSE_INSTANCE_URL:
                runtime.getSetting("DISCOURSE_INSTANCE_URL") ||
                process.env.DISCOURSE_INSTANCE_URL,
        };

        return discourseEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Discourse configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
