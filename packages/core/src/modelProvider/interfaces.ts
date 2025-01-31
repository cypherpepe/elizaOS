import type { ZodSchema } from "zod";
import type { IAgentRuntime, ModelClass, IVerifiableInferenceAdapter, VerifiableInferenceOptions, TelemetrySettings, ModelProviderName } from "../types";
import {
    generateObject as aiGenerateObject,
    type StepResult as AIStepResult,
    type CoreTool,
    type GenerateObjectResult
} from "ai";
import { elizaLogger } from "../logger";
import { CircuitBreaker } from "./utils";


export type Tool = CoreTool<any, any>;
export type StepResult = AIStepResult<any>;
export type { GenerateObjectResult };


/**
 * Configuration options for generating objects with a model.
 */
export interface GenerationOptions {
    runtime: IAgentRuntime;
    context: string;
    modelClass: ModelClass;
    schema?: ZodSchema;
    schemaName?: string;
    schemaDescription?: string;
    stop?: string[];
    mode?: "auto" | "json" | "tool";
    experimental_providerMetadata?: Record<string, unknown>;
    verifiableInference?: boolean;
    verifiableInferenceAdapter?: IVerifiableInferenceAdapter;
    verifiableInferenceOptions?: VerifiableInferenceOptions;
}

/**
 * Base settings for model generation.
 */
export interface IModelSettings {
    prompt: string;
    temperature: number;
    maxTokens: number;
    frequencyPenalty: number;
    presencePenalty: number;
    stop?: string[];
    experimental_telemetry?: TelemetrySettings;
}


/**
 * Interface for provider-specific generation options.
 */
export interface ProviderOptions {
    runtime: IAgentRuntime;
    provider: ModelProviderName;
    model: any;
    apiKey: string;
    schema?: ZodSchema;
    schemaName?: string;
    schemaDescription?: string;
    mode?: "auto" | "json" | "tool";
    experimental_providerMetadata?: Record<string, unknown>;
    modelOptions: IModelSettings;
    modelClass: ModelClass;
    context: string;
    verifiableInference?: boolean;
    verifiableInferenceAdapter?: IVerifiableInferenceAdapter;
    verifiableInferenceOptions?: VerifiableInferenceOptions;
}



/**
 * Interface for Image Generation Params
 */

export interface ImageGenerationParams {
    prompt: string;
    width: number;
    height: number;
    count?: number;
    negativePrompt?: string;
    numIterations?: number;
    guidanceScale?: number;
    seed?: number;
    modelId?: string;
    jobId?: string;
    stylePreset?: string;
    hideWatermark?: boolean;
    safeMode?: boolean;
    cfgScale?: number;
}

/**
 * Interface for Image Generation Result
 */
export interface ImageGenerationResult {
    success: boolean;
    data?: string[];
    error?: any;
}


// Base interface with common methods
interface BaseModelProvider {
    initialize(config: Record<string, unknown>): void;
    isFailed(): boolean;
}

// Individual generation method interfaces
interface TextGeneration {
    generateText(
        context: string,
        modelSettings: IModelSettings,
        runtime: IAgentRuntime
    ): Promise<string>;
}

interface ImageGeneration {
    generateImage(
        params: ImageGenerationParams,
        runtime: IAgentRuntime
    ): Promise<ImageGenerationResult>;
}

interface ObjectGeneration {
    generateObject<T>(
        options: GenerationOptions
    ): Promise<GenerateObjectResult<T>>;
}

// Combine them to require at least one generation method
export type ModelProvider = BaseModelProvider & (
    TextGeneration |
    ImageGeneration |
    ObjectGeneration |
    (TextGeneration & ImageGeneration) |
    (TextGeneration & ObjectGeneration) |
    (ImageGeneration & ObjectGeneration) |
    (TextGeneration & ImageGeneration & ObjectGeneration)
);



