import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import {
    generateText as aiGenerateText,
} from "ai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { createOllama } from "ollama-ai-provider";
import { elizaLogger, getOnChainEternalAISystemPrompt, handleProvider } from "../index.ts";
import {
    getEndpoint,
    getModelSettings,
    models
} from "../models.ts";
import {
    parseActionResponseFromText,
    parseBooleanFromText,
    parseJsonArrayFromText,
    parseJSONObjectFromText,
    parseShouldRespondFromText
} from "../parsing.ts";
import settings from "../settings.ts";
import {
    type ActionResponse,
    type Content,
    type IAgentRuntime,
    type ITextGenerationService,
    type IVerifiableInferenceAdapter,
    ModelClass,
    ModelProviderName,
    ServiceType,
    type VerifiableInferenceOptions,
    type VerifiableInferenceResult,
} from "../types.ts";
import type { GenerateObjectResult, GenerationOptions, IModelSettings, StepResult, Tool } from "./interfaces.ts";
import { getCloudflareGatewayBaseURL, trimTokens } from "./utils.ts";



/**
 * Send a message to the model for a text generateText - receive a string back and parse how you'd like
 * @param opts - The options for the generateText request.
 * @param opts.context The context of the message to be completed.
 * @param opts.stop A list of strings to stop the generateText at.
 * @param opts.model The model to use for generateText.
 * @param opts.frequency_penalty The frequency penalty to apply to the generateText.
 * @param opts.presence_penalty The presence penalty to apply to the generateText.
 * @param opts.temperature The temperature to apply to the generateText.
 * @param opts.max_context_length The maximum length of the context to apply to the generateText.
 * @returns The completed message.
 */

export async function generateText({
    runtime,
    context,
    modelClass,
    tools = {},
    onStepFinish,
    maxSteps = 1,
    stop,
    customSystemPrompt,
    verifiableInference = process.env.VERIFIABLE_INFERENCE_ENABLED === "true",
    verifiableInferenceOptions,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
    tools?: Record<string, Tool>;
    onStepFinish?: (event: StepResult) => Promise<void> | void;
    maxSteps?: number;
    stop?: string[];
    customSystemPrompt?: string;
    verifiableInference?: boolean;
    verifiableInferenceAdapter?: IVerifiableInferenceAdapter;
    verifiableInferenceOptions?: VerifiableInferenceOptions;
}): Promise<string> {
    if (!context) {
        console.error("generateText context is empty");
        return "";
    }

    elizaLogger.log("Generating text...");

    elizaLogger.info("Generating text with options:", {
        modelProvider: runtime.modelProvider,
        model: modelClass,
        verifiableInference,
    });
    elizaLogger.log("Using provider:", runtime.modelProvider);
    // If verifiable inference is requested and adapter is provided, use it
    if (verifiableInference && runtime.verifiableInferenceAdapter) {
        elizaLogger.log(
            "Using verifiable inference adapter:",
            runtime.verifiableInferenceAdapter
        );
        try {
            const result: VerifiableInferenceResult =
                await runtime.verifiableInferenceAdapter.generateText(
                    context,
                    modelClass,
                    verifiableInferenceOptions
                );
            elizaLogger.log("Verifiable inference result:", result);
            // Verify the proof
            const isValid =
                await runtime.verifiableInferenceAdapter.verifyProof(result);
            if (!isValid) {
                throw new Error("Failed to verify inference proof");
            }

            return result.text;
        } catch (error) {
            elizaLogger.error("Error in verifiable inference:", error);
            throw error;
        }
    }

    const provider = runtime.modelProvider;
    elizaLogger.debug("Provider settings:", {
        provider,
        hasRuntime: !!runtime,
        runtimeSettings: {
            CLOUDFLARE_GW_ENABLED: runtime.getSetting("CLOUDFLARE_GW_ENABLED"),
            CLOUDFLARE_AI_ACCOUNT_ID: runtime.getSetting(
                "CLOUDFLARE_AI_ACCOUNT_ID"
            ),
            CLOUDFLARE_AI_GATEWAY_ID: runtime.getSetting(
                "CLOUDFLARE_AI_GATEWAY_ID"
            ),
        },
    });

    const endpoint =
        runtime.character.modelEndpointOverride || getEndpoint(provider);
    const IModelSettings = getModelSettings(runtime.modelProvider, modelClass);
    let model = IModelSettings.name;

    // allow character.json settings => secrets to override models
    // FIXME: add MODEL_MEDIUM support
    switch (provider) {
        // if runtime.getSetting("LLAMACLOUD_MODEL_LARGE") is true and modelProvider is LLAMACLOUD, then use the large model
        case ModelProviderName.LLAMACLOUD:
            {
                switch (modelClass) {
                    case ModelClass.LARGE:
                        {
                            model =
                                runtime.getSetting("LLAMACLOUD_MODEL_LARGE") ||
                                model;
                        }
                        break;
                    case ModelClass.SMALL:
                        {
                            model =
                                runtime.getSetting("LLAMACLOUD_MODEL_SMALL") ||
                                model;
                        }
                        break;
                }
            }
            break;
        case ModelProviderName.TOGETHER:
            {
                switch (modelClass) {
                    case ModelClass.LARGE:
                        {
                            model =
                                runtime.getSetting("TOGETHER_MODEL_LARGE") ||
                                model;
                        }
                        break;
                    case ModelClass.SMALL:
                        {
                            model =
                                runtime.getSetting("TOGETHER_MODEL_SMALL") ||
                                model;
                        }
                        break;
                }
            }
            break;
        case ModelProviderName.OPENROUTER:
            {
                switch (modelClass) {
                    case ModelClass.LARGE:
                        {
                            model =
                                runtime.getSetting("LARGE_OPENROUTER_MODEL") ||
                                model;
                        }
                        break;
                    case ModelClass.SMALL:
                        {
                            model =
                                runtime.getSetting("SMALL_OPENROUTER_MODEL") ||
                                model;
                        }
                        break;
                }
            }
            break;
    }

    elizaLogger.info("Selected model:", model);

    const modelConfiguration = runtime.character?.settings?.modelConfig;
    const temperature =
        modelConfiguration?.temperature || IModelSettings.temperature;
    const frequency_penalty =
        modelConfiguration?.frequency_penalty ||
        IModelSettings.frequency_penalty;
    const presence_penalty =
        modelConfiguration?.presence_penalty || IModelSettings.presence_penalty;
    const max_context_length =
        modelConfiguration?.maxInputTokens || IModelSettings.maxInputTokens;
    const max_response_length =
        modelConfiguration?.max_response_length ||
        IModelSettings.maxOutputTokens;
    const experimental_telemetry =
        modelConfiguration?.experimental_telemetry ||
        IModelSettings.experimental_telemetry;

    const apiKey = runtime.token;

    try {
        elizaLogger.debug(
            `Trimming context to max length of ${max_context_length} tokens.`
        );

        context = await trimTokens(context, max_context_length, runtime);

        let response: string;

        const _stop = stop || IModelSettings.stop;
        elizaLogger.debug(
            `Using provider: ${provider}, model: ${model}, temperature: ${temperature}, max response length: ${max_response_length}`
        );

        switch (provider) {
            // OPENAI & LLAMACLOUD shared same structure.
            case ModelProviderName.OPENAI:
            case ModelProviderName.ALI_BAILIAN:
            case ModelProviderName.VOLENGINE:
            case ModelProviderName.LLAMACLOUD:
            case ModelProviderName.NANOGPT:
            case ModelProviderName.HYPERBOLIC:
            case ModelProviderName.TOGETHER:
            case ModelProviderName.NINETEEN_AI:
            case ModelProviderName.AKASH_CHAT_API:
            case ModelProviderName.LMSTUDIO: {
                elizaLogger.debug(
                    "Initializing OpenAI model with Cloudflare check"
                );
                const baseURL =
                    getCloudflareGatewayBaseURL(runtime, "openai") || endpoint;

                //elizaLogger.debug("OpenAI baseURL result:", { baseURL });
                const openai = createOpenAI({
                    apiKey,
                    baseURL,
                    fetch: runtime.fetch,
                });

                const { text: openaiResponse } = await aiGenerateText({
                    model: openai.languageModel(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = openaiResponse;
                console.log("Received response from OpenAI model.");
                break;
            }

            case ModelProviderName.ETERNALAI: {
                elizaLogger.debug("Initializing EternalAI model.");
                const openai = createOpenAI({
                    apiKey,
                    baseURL: endpoint,
                    fetch: async (
                        input: RequestInfo | URL,
                        init?: RequestInit
                    ): Promise<Response> => {
                        const url =
                            typeof input === "string"
                                ? input
                                : input.toString();
                        const chain_id =
                            runtime.getSetting("ETERNALAI_CHAIN_ID") || "45762";

                        const options: RequestInit = { ...init };
                        if (options?.body) {
                            const body = JSON.parse(options.body as string);
                            body.chain_id = chain_id;
                            options.body = JSON.stringify(body);
                        }

                        const fetching = await runtime.fetch(url, options);

                        if (
                            parseBooleanFromText(
                                runtime.getSetting("ETERNALAI_LOG")
                            )
                        ) {
                            elizaLogger.info(
                                "Request data: ",
                                JSON.stringify(options, null, 2)
                            );
                            const clonedResponse = fetching.clone();
                            try {
                                clonedResponse.json().then((data) => {
                                    elizaLogger.info(
                                        "Response data: ",
                                        JSON.stringify(data, null, 2)
                                    );
                                });
                            } catch (e) {
                                elizaLogger.debug(e);
                            }
                        }
                        return fetching;
                    },
                });

                let system_prompt =
                    runtime.character.system ??
                    settings.SYSTEM_PROMPT ??
                    undefined;
                try {
                    const on_chain_system_prompt =
                        await getOnChainEternalAISystemPrompt(runtime);
                    if (!on_chain_system_prompt) {
                        elizaLogger.error(
                            new Error("invalid on_chain_system_prompt")
                        );
                    } else {
                        system_prompt = on_chain_system_prompt;
                        elizaLogger.info(
                            "new on-chain system prompt",
                            system_prompt
                        );
                    }
                } catch (e) {
                    elizaLogger.error(e);
                }

                const { text: openaiResponse } = await aiGenerateText({
                    model: openai.languageModel(model),
                    prompt: context,
                    system: system_prompt,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                });

                response = openaiResponse;
                elizaLogger.debug("Received response from EternalAI model.");
                break;
            }

            case ModelProviderName.GOOGLE: {
                const google = createGoogleGenerativeAI({
                    apiKey,
                    fetch: runtime.fetch,
                });

                const { text: googleResponse } = await aiGenerateText({
                    model: google(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = googleResponse;
                elizaLogger.debug("Received response from Google model.");
                break;
            }

            case ModelProviderName.MISTRAL: {
                const mistral = createMistral();

                const { text: mistralResponse } = await aiGenerateText({
                    model: mistral(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                });

                response = mistralResponse;
                elizaLogger.debug("Received response from Mistral model.");
                break;
            }

            case ModelProviderName.ANTHROPIC: {
                elizaLogger.debug(
                    "Initializing Anthropic model with Cloudflare check"
                );
                const baseURL =
                    getCloudflareGatewayBaseURL(runtime, "anthropic") ||
                    "https://api.anthropic.com/v1";
                elizaLogger.debug("Anthropic baseURL result:", { baseURL });

                const anthropic = createAnthropic({
                    apiKey,
                    baseURL,
                    fetch: runtime.fetch,
                });
                const { text: anthropicResponse } = await aiGenerateText({
                    model: anthropic.languageModel(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = anthropicResponse;
                elizaLogger.debug("Received response from Anthropic model.");
                break;
            }

            case ModelProviderName.CLAUDE_VERTEX: {
                elizaLogger.debug("Initializing Claude Vertex model.");

                const anthropic = createAnthropic({
                    apiKey,
                    fetch: runtime.fetch,
                });

                const { text: anthropicResponse } = await aiGenerateText({
                    model: anthropic.languageModel(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = anthropicResponse;
                elizaLogger.debug(
                    "Received response from Claude Vertex model."
                );
                break;
            }

            case ModelProviderName.GROK: {
                elizaLogger.debug("Initializing Grok model.");
                const grok = createOpenAI({
                    apiKey,
                    baseURL: endpoint,
                    fetch: runtime.fetch,
                });

                const { text: grokResponse } = await aiGenerateText({
                    model: grok.languageModel(model, {
                        parallelToolCalls: false,
                    }),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = grokResponse;
                elizaLogger.debug("Received response from Grok model.");
                break;
            }

            case ModelProviderName.GROQ: {
                elizaLogger.debug(
                    "Initializing Groq model with Cloudflare check"
                );
                const baseURL = getCloudflareGatewayBaseURL(runtime, "groq");
                elizaLogger.debug("Groq baseURL result:", { baseURL });
                const groq = createGroq({
                    apiKey,
                    fetch: runtime.fetch,
                    baseURL,
                });

                const { text: groqResponse } = await aiGenerateText({
                    model: groq.languageModel(model),
                    prompt: context,
                    temperature,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools,
                    onStepFinish: onStepFinish,
                    maxSteps,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry,
                });

                response = groqResponse;
                elizaLogger.debug("Received response from Groq model.");
                break;
            }

            case ModelProviderName.LLAMALOCAL: {
                elizaLogger.debug(
                    "Using local Llama model for text completion."
                );
                const textGenerationService =
                    runtime.getService<ITextGenerationService>(
                        ServiceType.TEXT_GENERATION
                    );

                if (!textGenerationService) {
                    throw new Error("Text generation service not found");
                }

                response = await textGenerationService.queueTextCompletion(
                    context,
                    temperature,
                    _stop,
                    frequency_penalty,
                    presence_penalty,
                    max_response_length
                );
                elizaLogger.debug("Received response from local Llama model.");
                break;
            }

            case ModelProviderName.REDPILL: {
                elizaLogger.debug("Initializing RedPill model.");
                const serverUrl = getEndpoint(provider);
                const openai = createOpenAI({
                    apiKey,
                    baseURL: serverUrl,
                    fetch: runtime.fetch,
                });

                const { text: redpillResponse } = await aiGenerateText({
                    model: openai.languageModel(model),
                    prompt: context,
                    temperature: temperature,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = redpillResponse;
                elizaLogger.debug("Received response from redpill model.");
                break;
            }

            case ModelProviderName.OPENROUTER: {
                elizaLogger.debug("Initializing OpenRouter model.");
                const serverUrl = getEndpoint(provider);
                const openrouter = createOpenAI({
                    apiKey,
                    baseURL: serverUrl,
                    fetch: runtime.fetch,
                });

                const { text: openrouterResponse } = await aiGenerateText({
                    model: openrouter.languageModel(model),
                    prompt: context,
                    temperature: temperature,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = openrouterResponse;
                elizaLogger.debug("Received response from OpenRouter model.");
                break;
            }

            case ModelProviderName.OLLAMA:
                {
                    elizaLogger.debug("Initializing Ollama model.");

                    const ollamaProvider = createOllama({
                        baseURL: getEndpoint(provider) + "/api",
                        fetch: runtime.fetch,
                    });
                    const ollama = ollamaProvider(model);

                    elizaLogger.debug("****** MODEL\n", model);

                    const { text: ollamaResponse } = await aiGenerateText({
                        model: ollama,
                        prompt: context,
                        tools: tools,
                        onStepFinish: onStepFinish,
                        temperature: temperature,
                        maxSteps: maxSteps,
                        maxTokens: max_response_length,
                        frequencyPenalty: frequency_penalty,
                        presencePenalty: presence_penalty,
                        experimental_telemetry: experimental_telemetry,
                    });

                    response = ollamaResponse;
                }
                elizaLogger.debug("Received response from Ollama model.");
                break;

            case ModelProviderName.HEURIST: {
                elizaLogger.debug("Initializing Heurist model.");
                const heurist = createOpenAI({
                    apiKey: apiKey,
                    baseURL: endpoint,
                    fetch: runtime.fetch,
                });

                const { text: heuristResponse } = await aiGenerateText({
                    model: heurist.languageModel(model),
                    prompt: context,
                    system:
                        customSystemPrompt ??
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    maxSteps: maxSteps,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = heuristResponse;
                elizaLogger.debug("Received response from Heurist model.");
                break;
            }
            case ModelProviderName.GAIANET: {
                elizaLogger.debug("Initializing GAIANET model.");

                var baseURL = getEndpoint(provider);
                if (!baseURL) {
                    switch (modelClass) {
                        case ModelClass.SMALL:
                            baseURL =
                                settings.SMALL_GAIANET_SERVER_URL ||
                                "https://llama3b.gaia.domains/v1";
                            break;
                        case ModelClass.MEDIUM:
                            baseURL =
                                settings.MEDIUM_GAIANET_SERVER_URL ||
                                "https://llama8b.gaia.domains/v1";
                            break;
                        case ModelClass.LARGE:
                            baseURL =
                                settings.LARGE_GAIANET_SERVER_URL ||
                                "https://qwen72b.gaia.domains/v1";
                            break;
                    }
                }

                elizaLogger.debug("Using GAIANET model with baseURL:", baseURL);

                const openai = createOpenAI({
                    apiKey,
                    baseURL: endpoint,
                    fetch: runtime.fetch,
                });

                const { text: openaiResponse } = await aiGenerateText({
                    model: openai.languageModel(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = openaiResponse;
                elizaLogger.debug("Received response from GAIANET model.");
                break;
            }

            case ModelProviderName.ATOMA: {
                elizaLogger.debug("Initializing Atoma model.");
                const atoma = createOpenAI({
                    apiKey,
                    baseURL: endpoint,
                    fetch: runtime.fetch,
                });

                const { text: atomaResponse } = await aiGenerateText({
                    model: atoma.languageModel(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = atomaResponse;
                elizaLogger.debug("Received response from Atoma model.");
                break;
            }

            case ModelProviderName.GALADRIEL: {
                elizaLogger.debug("Initializing Galadriel model.");
                const headers = {};
                const fineTuneApiKey = runtime.getSetting(
                    "GALADRIEL_FINE_TUNE_API_KEY"
                );
                if (fineTuneApiKey) {
                    headers["Fine-Tune-Authentication"] = fineTuneApiKey;
                }
                const galadriel = createOpenAI({
                    headers,
                    apiKey: apiKey,
                    baseURL: endpoint,
                    fetch: runtime.fetch,
                });

                const { text: galadrielResponse } = await aiGenerateText({
                    model: galadriel.languageModel(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = galadrielResponse;
                elizaLogger.debug("Received response from Galadriel model.");
                break;
            }

            case ModelProviderName.INFERA: {
                elizaLogger.debug("Initializing Infera model.");

                const apiKey = settings.INFERA_API_KEY || runtime.token;

                const infera = createOpenAI({
                    apiKey,
                    baseURL: endpoint,
                    headers: {
                        api_key: apiKey,
                        "Content-Type": "application/json",
                    },
                });

                const { text: inferaResponse } = await aiGenerateText({
                    model: infera.languageModel(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    temperature: temperature,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                });
                response = inferaResponse;
                elizaLogger.debug("Received response from Infera model.");
                break;
            }

            case ModelProviderName.VENICE: {
                elizaLogger.debug("Initializing Venice model.");
                const venice = createOpenAI({
                    apiKey: apiKey,
                    baseURL: endpoint,
                });

                const { text: veniceResponse } = await aiGenerateText({
                    model: venice.languageModel(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    temperature: temperature,
                    maxSteps: maxSteps,
                    maxTokens: max_response_length,
                });

                response = veniceResponse;
                elizaLogger.debug("Received response from Venice model.");
                break;
            }

            case ModelProviderName.NVIDIA: {
                elizaLogger.debug("Initializing NVIDIA model.");
                const nvidia = createOpenAI({
                    apiKey: apiKey,
                    baseURL: endpoint,
                });

                const { text: nvidiaResponse } = await aiGenerateText({
                    model: nvidia.languageModel(model),
                    prompt: context,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    temperature: temperature,
                    maxSteps: maxSteps,
                    maxTokens: max_response_length,
                });

                response = nvidiaResponse;
                elizaLogger.debug("Received response from NVIDIA model.");
                break;
            }

            case ModelProviderName.DEEPSEEK: {
                elizaLogger.debug("Initializing Deepseek model.");
                const serverUrl = models[provider].endpoint;
                const deepseek = createOpenAI({
                    apiKey,
                    baseURL: serverUrl,
                    fetch: runtime.fetch,
                });

                const { text: deepseekResponse } = await aiGenerateText({
                    model: deepseek.languageModel(model),
                    prompt: context,
                    temperature: temperature,
                    system:
                        runtime.character.system ??
                        settings.SYSTEM_PROMPT ??
                        undefined,
                    tools: tools,
                    onStepFinish: onStepFinish,
                    maxSteps: maxSteps,
                    maxTokens: max_response_length,
                    frequencyPenalty: frequency_penalty,
                    presencePenalty: presence_penalty,
                    experimental_telemetry: experimental_telemetry,
                });

                response = deepseekResponse;
                elizaLogger.debug("Received response from Deepseek model.");
                break;
            }

            case ModelProviderName.LIVEPEER: {
                elizaLogger.debug("Initializing Livepeer model.");

                if (!endpoint) {
                    throw new Error("Livepeer Gateway URL is not defined");
                }

                const requestBody = {
                    model: model,
                    messages: [
                        {
                            role: "system",
                            content:
                                runtime.character.system ??
                                settings.SYSTEM_PROMPT ??
                                "You are a helpful assistant",
                        },
                        {
                            role: "user",
                            content: context,
                        },
                    ],
                    max_tokens: max_response_length,
                    stream: false,
                };

                const fetchResponse = await runtime.fetch(endpoint + "/llm", {
                    method: "POST",
                    headers: {
                        accept: "text/event-stream",
                        "Content-Type": "application/json",
                        Authorization: "Bearer eliza-app-llm",
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!fetchResponse.ok) {
                    const errorText = await fetchResponse.text();
                    throw new Error(
                        `Livepeer request failed (${fetchResponse.status}): ${errorText}`
                    );
                }

                const json = await fetchResponse.json();

                if (!json?.choices?.[0]?.message?.content) {
                    throw new Error("Invalid response format from Livepeer");
                }

                response = json.choices[0].message.content.replace(
                    /<\|start_header_id\|>assistant<\|end_header_id\|>\n\n/,
                    ""
                );
                elizaLogger.debug(
                    "Successfully received response from Livepeer model"
                );
                break;
            }

            default: {
                const errorMessage = `Unsupported provider: ${provider}`;
                elizaLogger.error(errorMessage);
                throw new Error(errorMessage);
            }
        }

        return response;
    } catch (error) {
        elizaLogger.error("Error in generateText:", error);
        throw error;
    }
}

/**
 * Sends a message to the model to determine if it should respond to the given context.
 * @param opts - The options for the generateText request
 * @param opts.context The context to evaluate for response
 * @param opts.stop A list of strings to stop the generateText at
 * @param opts.model The model to use for generateText
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to "RESPOND", "IGNORE", "STOP" or null
 */
export async function generateShouldRespond({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<"RESPOND" | "IGNORE" | "STOP" | null> {
    let retryDelay = 1000;
    while (true) {
        try {
            elizaLogger.debug(
                "Attempting to generate text with context:",
                context
            );
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            elizaLogger.debug("Received response from generateText:", response);
            const parsedResponse = parseShouldRespondFromText(response.trim());
            if (parsedResponse) {
                elizaLogger.debug("Parsed response:", parsedResponse);
                return parsedResponse;
            } else {
                elizaLogger.debug("generateShouldRespond no response");
            }
        } catch (error) {
            elizaLogger.error("Error in generateShouldRespond:", error);
            if (
                error instanceof TypeError &&
                error.message.includes("queueTextCompletion")
            ) {
                elizaLogger.error(
                    "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
                );
            }
        }

        elizaLogger.log(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

/**
 * Splits content into chunks of specified size with optional overlapping bleed sections
 * @param content - The text content to split into chunks
 * @param chunkSize - The maximum size of each chunk in tokens
 * @param bleed - Number of characters to overlap between chunks (default: 100)
 * @returns Promise resolving to array of text chunks with bleed sections
 */
export async function splitChunks(
    content: string,
    chunkSize = 512,
    bleed = 20
): Promise<string[]> {
    elizaLogger.debug("[splitChunks] Starting text split");

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: Number(chunkSize),
        chunkOverlap: Number(bleed),
    });

    const chunks = await textSplitter.splitText(content);
    elizaLogger.debug("[splitChunks] Split complete:", {
        numberOfChunks: chunks.length,
        averageChunkSize:
            chunks.reduce((acc, chunk) => acc + chunk.length, 0) /
            chunks.length,
    });

    return chunks;
}

/**
 * Sends a message to the model and parses the response as a boolean value
 * @param opts - The options for the generateText request
 * @param opts.context The context to evaluate for the boolean response
 * @param opts.stop A list of strings to stop the generateText at
 * @param opts.model The model to use for generateText
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to a boolean value parsed from the model's response
 */
export async function generateTrueOrFalse({
    runtime,
    context = "",
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<boolean> {
    let retryDelay = 1000;
    const IModelSettings = getModelSettings(runtime.modelProvider, modelClass);
    const stop = Array.from(
        new Set([...(IModelSettings.stop || []), ["\n"]])
    ) as string[];

    while (true) {
        try {
            const response = await generateText({
                stop,
                runtime,
                context,
                modelClass,
            });

            const parsedResponse = parseBooleanFromText(response.trim());
            if (parsedResponse !== null) {
                return parsedResponse;
            }
        } catch (error) {
            elizaLogger.error("Error in generateTrueOrFalse:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

/**
 * Send a message to the model and parse the response as a string array
 * @param opts - The options for the generateText request
 * @param opts.context The context/prompt to send to the model
 * @param opts.stop Array of strings that will stop the model's generation if encountered
 * @param opts.model The language model to use
 * @param opts.frequency_penalty The frequency penalty to apply (0.0 to 2.0)
 * @param opts.presence_penalty The presence penalty to apply (0.0 to 2.0)
 * @param opts.temperature The temperature to control randomness (0.0 to 2.0)
 * @param opts.serverUrl The URL of the API server
 * @param opts.token The API token for authentication
 * @param opts.max_context_length Maximum allowed context length in tokens
 * @param opts.max_response_length Maximum allowed response length in tokens
 * @returns Promise resolving to an array of strings parsed from the model's response
 */
export async function generateTextArray({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<string[]> {
    if (!context) {
        elizaLogger.error("generateTextArray context is empty");
        return [];
    }
    let retryDelay = 1000;

    while (true) {
        try {
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            const parsedResponse = parseJsonArrayFromText(response);
            if (parsedResponse) {
                return parsedResponse;
            }
        } catch (error) {
            elizaLogger.error("Error in generateTextArray:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

export async function generateObjectDeprecated({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<any> {
    if (!context) {
        elizaLogger.error("generateObjectDeprecated context is empty");
        return null;
    }
    let retryDelay = 1000;

    while (true) {
        try {
            // this is slightly different than generateObjectArray, in that we parse object, not object array
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });
            const parsedResponse = parseJSONObjectFromText(response);
            if (parsedResponse) {
                return parsedResponse;
            }
        } catch (error) {
            elizaLogger.error("Error in generateObject:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

export async function generateObjectArray({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<any[]> {
    if (!context) {
        elizaLogger.error("generateObjectArray context is empty");
        return [];
    }
    let retryDelay = 1000;

    while (true) {
        try {
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            const parsedResponse = parseJsonArrayFromText(response);
            if (parsedResponse) {
                return parsedResponse;
            }
        } catch (error) {
            elizaLogger.error("Error in generateTextArray:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}

/**
 * Send a message to the model for generateText.
 * @param opts - The options for the generateText request.
 * @param opts.context The context of the message to be completed.
 * @param opts.stop A list of strings to stop the generateText at.
 * @param opts.model The model to use for generateText.
 * @param opts.frequency_penalty The frequency penalty to apply to the generateText.
 * @param opts.presence_penalty The presence penalty to apply to the generateText.
 * @param opts.temperature The temperature to apply to the generateText.
 * @param opts.max_context_length The maximum length of the context to apply to the generateText.
 * @returns The completed message.
 */
export async function generateMessageResponse({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<Content> {
    const IModelSettings = getModelSettings(runtime.modelProvider, modelClass);
    const max_context_length = IModelSettings.maxInputTokens;

    context = await trimTokens(context, max_context_length, runtime);
    elizaLogger.debug("Context:", context);
    let retryLength = 1000; // exponential backoff
    while (true) {
        try {
            elizaLogger.log("Generating message response..");

            const response = await generateText({
                runtime,
                context,
                modelClass,
            });

            // try parsing the response as JSON, if null then try again
            const parsedContent = parseJSONObjectFromText(response) as Content;
            if (!parsedContent) {
                elizaLogger.debug("parsedContent is null, retrying");
                continue;
            }

            return parsedContent;
        } catch (error) {
            elizaLogger.error("ERROR:", error);
            // wait for 2 seconds
            retryLength *= 2;
            await new Promise((resolve) => setTimeout(resolve, retryLength));
            elizaLogger.debug("Retrying...");
        }
    }
}


/**
 * Generates structured objects from a prompt using specified AI models and configuration options.
 *
 * @param {GenerationOptions} options - Configuration options for generating objects.
 * @returns {Promise<any[]>} - A promise that resolves to an array of generated objects.
 * @throws {Error} - Throws an error if the provider is unsupported or if generation fails.
 */
export const generateObject = async ({
    runtime,
    context,
    modelClass,
    schema,
    schemaName,
    schemaDescription,
    stop,
    mode = "json",
    verifiableInference = false,
    verifiableInferenceAdapter,
    verifiableInferenceOptions,
}: GenerationOptions): Promise<GenerateObjectResult<unknown>> => {
    if (!context) {
        const errorMessage = "generateObject context is empty";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const provider = runtime.modelProvider;
    const IModelSettings = getModelSettings(runtime.modelProvider, modelClass);
    const model = IModelSettings.name;
    const temperature = IModelSettings.temperature;
    const frequency_penalty = IModelSettings.frequency_penalty;
    const presence_penalty = IModelSettings.presence_penalty;
    const max_context_length = IModelSettings.maxInputTokens;
    const max_response_length = IModelSettings.maxOutputTokens;
    const experimental_telemetry = IModelSettings.experimental_telemetry;
    const apiKey = runtime.token;

    try {
        context = await trimTokens(context, max_context_length, runtime);

        const modelOptions: IModelSettings = {
            prompt: context,
            temperature,
            maxTokens: max_response_length,
            frequencyPenalty: frequency_penalty,
            presencePenalty: presence_penalty,
            stop: stop || IModelSettings.stop,
            experimental_telemetry: experimental_telemetry,
        };

        const response = await handleProvider({
            provider,
            model,
            apiKey,
            schema,
            schemaName,
            schemaDescription,
            mode,
            modelOptions,
            runtime,
            context,
            modelClass,
            verifiableInference,
            verifiableInferenceAdapter,
            verifiableInferenceOptions,
        });

        return response;
    } catch (error) {
        console.error("Error in generateObject:", error);
        throw error;
    }
};

export async function generateTweetActions({
    runtime,
    context,
    modelClass,
}: {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
}): Promise<ActionResponse | null> {
    let retryDelay = 1000;
    while (true) {
        try {
            const response = await generateText({
                runtime,
                context,
                modelClass,
            });
            elizaLogger.debug(
                "Received response from generateText for tweet actions:",
                response
            );
            const { actions } = parseActionResponseFromText(response.trim());
            if (actions) {
                elizaLogger.debug("Parsed tweet actions:", actions);
                return actions;
            }
            elizaLogger.debug("generateTweetActions no valid response");
        } catch (error) {
            elizaLogger.error("Error in generateTweetActions:", error);
            if (
                error instanceof TypeError &&
                error.message.includes("queueTextCompletion")
            ) {
                elizaLogger.error(
                    "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
                );
            }
        }
        elizaLogger.log(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        retryDelay *= 2;
    }
}
