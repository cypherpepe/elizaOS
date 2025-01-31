// Disclaimer: This file is to be removed once the new provider is implemented
// All ModelProviders would have to move to their separate folders


// External SDK/Provider imports
import { bedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject as aiGenerateObject, type GenerateObjectResult } from "ai";
import { createOllama } from "ollama-ai-provider";

// Local imports - Types
import { ModelProviderName } from "../types.ts";
import type { ProviderOptions } from "./interfaces.ts";

// Local imports - Utils & Services
import { elizaLogger } from "../index.ts";
import { getEndpoint, models } from "../models.ts";
import { generateObjectDeprecated, generateText, splitChunks } from "./text.ts";
import { getCloudflareGatewayBaseURL } from "./utils.ts";

// Exports
export { generateText, splitChunks };


/**
 * Handles AI generation based on the specified provider.
 *
 * @param {ProviderOptions} options - Configuration options specific to the provider.
 * @returns {Promise<any[]>} - A promise that resolves to an array of generated objects.
 */
export async function handleProvider(
    options: ProviderOptions
): Promise<GenerateObjectResult<unknown>> {
    const {
        provider,
        runtime,
        context,
        modelClass,
        //verifiableInference,
        //verifiableInferenceAdapter,
        //verifiableInferenceOptions,
    } = options;
    switch (provider) {
        case ModelProviderName.OPENAI:
        case ModelProviderName.ETERNALAI:
        case ModelProviderName.ALI_BAILIAN:
        case ModelProviderName.VOLENGINE:
        case ModelProviderName.LLAMACLOUD:
        case ModelProviderName.TOGETHER:
        case ModelProviderName.NANOGPT:
        case ModelProviderName.AKASH_CHAT_API:
        case ModelProviderName.LMSTUDIO:
            return await handleOpenAI(options);
        case ModelProviderName.ANTHROPIC:
        case ModelProviderName.CLAUDE_VERTEX:
            return await handleAnthropic(options);
        case ModelProviderName.GROK:
            return await handleGrok(options);
        case ModelProviderName.GROQ:
            return await handleGroq(options);
        case ModelProviderName.LLAMALOCAL:
            return await generateObjectDeprecated({
                runtime,
                context,
                modelClass,
            });
        case ModelProviderName.GOOGLE:
            return await handleGoogle(options);
        case ModelProviderName.MISTRAL:
            return await handleMistral(options);
        case ModelProviderName.REDPILL:
            return await handleRedPill(options);
        case ModelProviderName.OPENROUTER:
            return await handleOpenRouter(options);
        case ModelProviderName.OLLAMA:
            return await handleOllama(options);
        case ModelProviderName.DEEPSEEK:
            return await handleDeepSeek(options);
        case ModelProviderName.LIVEPEER:
            return await handleLivepeer(options);
        default: {
            const errorMessage = `Unsupported provider: ${provider}`;
            elizaLogger.error(errorMessage);
            throw new Error(errorMessage);
        }
    }
}
/**
 * Handles object generation for OpenAI.
 *
 * @param {ProviderOptions} options - Options specific to OpenAI.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleOpenAI({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
    provider: _provider,
    runtime,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const baseURL =
        getCloudflareGatewayBaseURL(runtime, "openai") ||
        models.openai.endpoint;
    const openai = createOpenAI({ apiKey, baseURL });
    return await aiGenerateObject({
        model: openai.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Anthropic models.
 *
 * @param {ProviderOptions} options - Options specific to Anthropic.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleAnthropic({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
    runtime,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    elizaLogger.debug("Handling Anthropic request with Cloudflare check");
    const baseURL = getCloudflareGatewayBaseURL(runtime, "anthropic");
    elizaLogger.debug("Anthropic handleAnthropic baseURL:", { baseURL });

    const anthropic = createAnthropic({ apiKey, baseURL });
    return await aiGenerateObject({
        model: anthropic.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Grok models.
 *
 * @param {ProviderOptions} options - Options specific to Grok.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleGrok({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const grok = createOpenAI({ apiKey, baseURL: models.grok.endpoint });
    return await aiGenerateObject({
        model: grok.languageModel(model, { parallelToolCalls: false }),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Groq models.
 *
 * @param {ProviderOptions} options - Options specific to Groq.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleGroq({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
    runtime,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    elizaLogger.debug("Handling Groq request with Cloudflare check");
    const baseURL = getCloudflareGatewayBaseURL(runtime, "groq");
    elizaLogger.debug("Groq handleGroq baseURL:", { baseURL });

    const groq = createGroq({ apiKey, baseURL });
    return await aiGenerateObject({
        model: groq.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Google models.
 *
 * @param {ProviderOptions} options - Options specific to Google.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleGoogle({
    model,
    apiKey: _apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const google = createGoogleGenerativeAI();
    return await aiGenerateObject({
        model: google(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Mistral models.
 *
 * @param {ProviderOptions} options - Options specific to Mistral.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleMistral({
    model,
    schema,
    schemaName,
    schemaDescription,
    mode,
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const mistral = createMistral();
    return await aiGenerateObject({
        model: mistral(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Redpill models.
 *
 * @param {ProviderOptions} options - Options specific to Redpill.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleRedPill({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const redPill = createOpenAI({ apiKey, baseURL: models.redpill.endpoint });
    return await aiGenerateObject({
        model: redPill.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for OpenRouter models.
 *
 * @param {ProviderOptions} options - Options specific to OpenRouter.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleOpenRouter({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const openRouter = createOpenAI({
        apiKey,
        baseURL: models.openrouter.endpoint,
    });
    return await aiGenerateObject({
        model: openRouter.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Ollama models.
 *
 * @param {ProviderOptions} options - Options specific to Ollama.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleOllama({
    model,
    schema,
    schemaName,
    schemaDescription,
    mode = "json",
    modelOptions,
    provider,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const ollamaProvider = createOllama({
        baseURL: `${getEndpoint(provider)}/api`,
    });
    const ollama = ollamaProvider(model);
    return await aiGenerateObject({
        model: ollama,
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for DeepSeek models.
 *
 * @param {ProviderOptions} options - Options specific to DeepSeek.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleDeepSeek({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode,
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    const openai = createOpenAI({ apiKey, baseURL: models.deepseek.endpoint });
    return await aiGenerateObject({
        model: openai.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

/**
 * Handles object generation for Amazon Bedrock models.
 *
 * @param {ProviderOptions} options - Options specific to Amazon Bedrock.
 * @returns {Promise<GenerateObjectResult<unknown>>} - A promise that resolves to generated objects.
 */
async function handleBedrock({
    model,
    schema,
    schemaName,
    schemaDescription,
    mode,
    modelOptions,
    provider,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    return await aiGenerateObject({
        model: bedrock(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}

async function handleLivepeer({
    model,
    apiKey,
    schema,
    schemaName,
    schemaDescription,
    mode,
    modelOptions,
}: ProviderOptions): Promise<GenerateObjectResult<unknown>> {
    console.log("Livepeer provider api key:", apiKey);
    if (!apiKey) {
        throw new Error(
            "Livepeer provider requires LIVEPEER_GATEWAY_URL to be configured"
        );
    }

    const livepeerClient = createOpenAI({
        apiKey,
        baseURL: apiKey, // Use the apiKey as the baseURL since it contains the gateway URL
    });

    return await aiGenerateObject({
        model: livepeerClient.languageModel(model),
        schema,
        schemaName,
        schemaDescription,
        mode,
        ...modelOptions,
    });
}