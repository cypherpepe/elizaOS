import { encodingForModel } from "js-tiktoken";
import { AutoTokenizer } from "@huggingface/transformers";
import type { TiktokenModel } from "js-tiktoken";
import { elizaLogger } from "../logger";
import { TokenizerType, type IAgentRuntime } from "../types";

/**
 * Trims the provided text context to a specified token limit using a tokenizer model and type.
 *
 * The function dynamically determines the truncation method based on the tokenizer settings
 * provided by the runtime. If no tokenizer settings are defined, it defaults to using the
 * TikToken truncation method with the "gpt-4o" model.
 *
 * @async
 * @function trimTokens
 * @param {string} context - The text to be tokenized and trimmed.
 * @param {number} maxTokens - The maximum number of tokens allowed after truncation.
 * @param {IAgentRuntime} runtime - The runtime interface providing tokenizer settings.
 *
 * @returns {Promise<string>} A promise that resolves to the trimmed text.
 *
 * @throws {Error} Throws an error if the runtime settings are invalid or missing required fields.
 *
 * @example
 * const trimmedText = await trimTokens("This is an example text", 50, runtime);
 * console.log(trimmedText); // Output will be a truncated version of the input text.
 */
export async function trimTokens(
    context: string,
    maxTokens: number,
    runtime: IAgentRuntime
) {
    if (!context) return "";
    if (maxTokens <= 0) throw new Error("maxTokens must be positive");

    const tokenizerModel = runtime.getSetting("TOKENIZER_MODEL");
    const tokenizerType = runtime.getSetting("TOKENIZER_TYPE");

    if (!tokenizerModel || !tokenizerType) {
        // Default to TikToken truncation using the "gpt-4o" model if tokenizer settings are not defined
        return truncateTiktoken("gpt-4o", context, maxTokens);
    }

    // Choose the truncation method based on tokenizer type
    if (tokenizerType === TokenizerType.Auto) {
        return truncateAuto(tokenizerModel, context, maxTokens);
    }

    if (tokenizerType === TokenizerType.TikToken) {
        return truncateTiktoken(
            tokenizerModel as TiktokenModel,
            context,
            maxTokens
        );
    }

    elizaLogger.warn(`Unsupported tokenizer type: ${tokenizerType}`);
    return truncateTiktoken("gpt-4o", context, maxTokens);
}

export async function truncateAuto(
    modelPath: string,
    context: string,
    maxTokens: number
) {
    try {
        const tokenizer = await AutoTokenizer.from_pretrained(modelPath);
        const tokens = tokenizer.encode(context);

        // If already within limits, return unchanged
        if (tokens.length <= maxTokens) {
            return context;
        }

        // Keep the most recent tokens by slicing from the end
        const truncatedTokens = tokens.slice(-maxTokens);

        // Decode back to text - js-tiktoken decode() returns a string directly
        return tokenizer.decode(truncatedTokens);
    } catch (error) {
        elizaLogger.error("Error in trimTokens:", error);
        // Return truncated string if tokenization fails
        return context.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
    }
}

export async function truncateTiktoken(
    model: TiktokenModel,
    context: string,
    maxTokens: number
) {
    try {
        const encoding = encodingForModel(model);

        // Encode the text into tokens
        const tokens = encoding.encode(context);

        // If already within limits, return unchanged
        if (tokens.length <= maxTokens) {
            return context;
        }

        // Keep the most recent tokens by slicing from the end
        const truncatedTokens = tokens.slice(-maxTokens);

        // Decode back to text - js-tiktoken decode() returns a string directly
        return encoding.decode(truncatedTokens);
    } catch (error) {
        elizaLogger.error("Error in trimTokens:", error);
        // Return truncated string if tokenization fails
        return context.slice(-maxTokens * 4); // Rough estimate of 4 chars per token
    }
}


/**
 * Gets the Cloudflare Gateway base URL for a specific provider if enabled
 * @param runtime The runtime environment
 * @param provider The model provider name
 * @returns The Cloudflare Gateway base URL if enabled, undefined otherwise
 */
export function getCloudflareGatewayBaseURL(
    runtime: IAgentRuntime,
    provider: string
): string | undefined {
    const isCloudflareEnabled =
        runtime.getSetting("CLOUDFLARE_GW_ENABLED") === "true";
    const cloudflareAccountId = runtime.getSetting("CLOUDFLARE_AI_ACCOUNT_ID");
    const cloudflareGatewayId = runtime.getSetting("CLOUDFLARE_AI_GATEWAY_ID");

    elizaLogger.debug("Cloudflare Gateway Configuration:", {
        isEnabled: isCloudflareEnabled,
        hasAccountId: !!cloudflareAccountId,
        hasGatewayId: !!cloudflareGatewayId,
        provider: provider,
    });

    if (!isCloudflareEnabled) {
        elizaLogger.debug("Cloudflare Gateway is not enabled");
        return undefined;
    }

    if (!cloudflareAccountId) {
        elizaLogger.warn(
            "Cloudflare Gateway is enabled but CLOUDFLARE_AI_ACCOUNT_ID is not set"
        );
        return undefined;
    }

    if (!cloudflareGatewayId) {
        elizaLogger.warn(
            "Cloudflare Gateway is enabled but CLOUDFLARE_AI_GATEWAY_ID is not set"
        );
        return undefined;
    }

    const baseURL = `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/${provider.toLowerCase()}`;
    elizaLogger.info("Using Cloudflare Gateway:", {
        provider,
        baseURL,
        accountId: cloudflareAccountId,
        gatewayId: cloudflareGatewayId,
    });

    return baseURL;
}


/**
 * CircuitBreaker implements the Circuit Breaker pattern to prevent repeated failures
 * and provide fault tolerance in distributed systems.
 * 
 * States:
 * - CLOSED: Normal operation, requests are allowed through
 * - OPEN: Failure threshold exceeded, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 * 
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 30000 });
 * 
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await someAsyncOperation();
 *   });
 * } catch (error) {
 *   // Handle error
 * }
 * ```
 */
export class CircuitBreaker {
    /** Current state of the circuit breaker */
    private state: 'OPEN' | 'CLOSED' | 'HALF_OPEN' = 'CLOSED';
    
    /** Counter for consecutive failures */
    private failureCount = 0;
    
    /** Maximum number of failures before opening the circuit */
    private readonly failureThreshold: number;
    
    /** Time in milliseconds before attempting to reset the circuit */
    private readonly resetTimeout: number;

    /**
     * Creates a new CircuitBreaker instance
     * 
     * @param config - Configuration object for the circuit breaker
     * @param config.failureThreshold - Number of failures before opening the circuit
     * @param config.resetTimeout - Time in milliseconds before attempting to reset
     * 
     * @throws {Error} If configuration parameters are invalid
     */
    constructor(config: Record<string, unknown>) {
        if (!config) {
            throw new Error('Configuration is required');
        }

        this.failureThreshold = (config.failureThreshold as number) || 5;
        this.resetTimeout = (config.resetTimeout as number) || 60000;

        if (this.failureThreshold <= 0) {
            throw new Error('Failure threshold must be greater than 0');
        }
        if (this.resetTimeout <= 0) {
            throw new Error('Reset timeout must be greater than 0');
        }
    }

    /**
     * Executes an operation with circuit breaker protection
     * 
     * @template T - The type of the operation's result
     * @param operation - The async operation to execute
     * @returns Promise resolving to the operation's result
     * @throws {Error} If circuit is OPEN or if operation fails
     * 
     * @example
     * ```typescript
     * const result = await breaker.execute(async () => {
     *   const response = await fetch('https://api.example.com/data');
     *   return response.json();
     * });
     * ```
     */
    async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            throw new Error('Circuit breaker is OPEN - requests are blocked');
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * Handles successful operation execution
     * Resets failure count and ensures circuit is CLOSED
     * 
     * @private
     */
    private onSuccess(): void {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    /**
     * Handles operation failures
     * Increments failure count and opens circuit if threshold is reached
     * 
     * @private
     */
    private onFailure(): void {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.scheduleReset();
        }
    }

    /**
     * Schedules a reset attempt after the configured timeout
     * 
     * @private
     */
    private scheduleReset(): void {
        setTimeout(() => {
            this.state = 'HALF_OPEN';
        }, this.resetTimeout);
    }

    /**
     * Gets the current state of the circuit breaker
     * 
     * @returns The current state ('OPEN', 'CLOSED', or 'HALF_OPEN')
     */
    getState(): string {
        return this.state;
    }

    /**
     * Gets the current failure count
     * 
     * @returns The number of consecutive failures
     */
    getFailureCount(): number {
        return this.failureCount;
    }

    /**
     * Manually resets the circuit breaker to its initial state
     * Useful for testing or administrative purposes
     */
    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
    }
}
