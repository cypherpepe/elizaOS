import { fal } from "@fal-ai/client";
import OpenAI from "openai";
import Together from "together-ai";
import elizaLogger from "../logger";
import { getImageModelSettings } from "../models";
import { type IAgentRuntime, ModelProviderName } from "../types";
import type { ImageGenerationParams, ImageGenerationResult } from "./interfaces";
import { type IImageDescriptionService, ServiceType } from "../types";

interface TogetherAIImageResponse {
    data: Array<{ url: string }>;
}

// Utility Functions
async function convertUrlToBase64(imageUrl: string, contentType = 'image/jpeg'): Promise<string> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
}

function getApiKey(runtime: IAgentRuntime, provider: ModelProviderName): string {
    if (runtime.imageModelProvider === runtime.modelProvider) {
        return runtime.token;
    }

    const providerKeyMap = {
        [ModelProviderName.HEURIST]: "HEURIST_API_KEY",
        [ModelProviderName.TOGETHER]: "TOGETHER_API_KEY",
        [ModelProviderName.FAL]: "FAL_API_KEY",
        [ModelProviderName.OPENAI]: "OPENAI_API_KEY",
        [ModelProviderName.VENICE]: "VENICE_API_KEY",
        [ModelProviderName.LIVEPEER]: "LIVEPEER_GATEWAY_URL"
    };

    const specificKey = providerKeyMap[provider];
    if (specificKey) {
        return runtime.getSetting(specificKey);
    }

    // Fallback chain
    return runtime.getSetting("HEURIST_API_KEY") ??
           runtime.getSetting("NINETEEN_AI_API_KEY") ??
           runtime.getSetting("TOGETHER_API_KEY") ??
           runtime.getSetting("FAL_API_KEY") ??
           runtime.getSetting("OPENAI_API_KEY") ??
           runtime.getSetting("VENICE_API_KEY") ??
           runtime.getSetting("LIVEPEER_GATEWAY_URL");
}

// Provider Implementations
const providers = {
    async [ModelProviderName.HEURIST](params: ImageGenerationParams, apiKey: string, model: string): Promise<ImageGenerationResult> {
        const response = await fetch("http://sequencer.heurist.xyz/submit_job", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                job_id: params.jobId || crypto.randomUUID(),
                model_input: {
                    SD: {
                        prompt: params.prompt,
                        neg_prompt: params.negativePrompt,
                        num_iterations: params.numIterations || 20,
                        width: params.width || 512,
                        height: params.height || 512,
                        guidance_scale: params.guidanceScale || 3,
                        seed: params.seed || -1,
                    },
                },
                model_id: model,
                deadline: 60,
                priority: 1,
            }),
        });

        if (!response.ok) {
            throw new Error(`Heurist image generation failed: ${response.statusText}`);
        }

        const imageURL = await response.json();
        return { success: true, data: [imageURL] };
    },

    async [ModelProviderName.TOGETHER](params: ImageGenerationParams, apiKey: string, model: string): Promise<ImageGenerationResult> {
        const together = new Together({ apiKey });
        const response = await together.images.create({
            model,
            prompt: params.prompt,
            width: params.width,
            height: params.height,
            steps: getImageModelSettings(ModelProviderName.TOGETHER)?.steps ?? 4,
            n: params.count,
        });

        const togetherResponse = response as unknown as TogetherAIImageResponse;
        if (!togetherResponse.data || !Array.isArray(togetherResponse.data)) {
            throw new Error("Invalid response format from Together AI");
        }

        const base64s = await Promise.all(
            togetherResponse.data.map(async (image) => {
                if (!image.url) {
                    throw new Error("Missing URL in Together AI response");
                }
                return await convertUrlToBase64(image.url);
            })
        );

        return { success: true, data: base64s };
    },

    async [ModelProviderName.FAL](params: ImageGenerationParams, apiKey: string, model: string): Promise<ImageGenerationResult> {
        fal.config({ credentials: apiKey });

        const input = {
            prompt: params.prompt,
            image_size: "square" as const,
            num_inference_steps: getImageModelSettings(ModelProviderName.FAL)?.steps ?? 50,
            guidance_scale: params.guidanceScale || 3.5,
            num_images: params.count,
            enable_safety_checker: false,
            safety_tolerance: 2,
            output_format: "png" as const,
            seed: params.seed ?? 6252023,
        };

        const result = await fal.subscribe(model, {
            input,
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    elizaLogger.info(update.logs.map((log) => log.message));
                }
            },
        });

        const base64s = await Promise.all(
            result.data.images.map(async (image: { url: string, content_type: string }) => {
                return await convertUrlToBase64(image.url, image.content_type);
            })
        );

        return { success: true, data: base64s };
    },

    async [ModelProviderName.VENICE](params: ImageGenerationParams, apiKey: string, model: string): Promise<ImageGenerationResult> {
        const response = await fetch("https://api.venice.ai/api/v1/image/generate", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                prompt: params.prompt,
                cfg_scale: params.guidanceScale,
                negative_prompt: params.negativePrompt,
                width: params.width,
                height: params.height,
                steps: params.numIterations,
                safe_mode: params.safeMode,
                seed: params.seed,
                style_preset: params.stylePreset,
                hide_watermark: params.hideWatermark,
            }),
        });

        const result = await response.json();
        if (!result.images || !Array.isArray(result.images)) {
            throw new Error("Invalid response format from Venice AI");
        }

        const base64s = result.images.map((base64String: string) => {
            if (!base64String) {
                throw new Error("Empty base64 string in Venice AI response");
            }
            return `data:image/png;base64,${base64String}`;
        });

        return { success: true, data: base64s };
    },

    async [ModelProviderName.NINETEEN_AI](params: ImageGenerationParams, apiKey: string, model: string): Promise<ImageGenerationResult> {
        const response = await fetch("https://api.nineteen.ai/v1/text-to-image", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                prompt: params.prompt,
                negative_prompt: params.negativePrompt,
                width: params.width,
                height: params.height,
                steps: params.numIterations,
                cfg_scale: params.guidanceScale || 3,
            }),
        });

        const result = await response.json();
        if (!result.images || !Array.isArray(result.images)) {
            throw new Error("Invalid response format from Nineteen AI");
        }

        const base64s = result.images.map((base64String: string) => {
            if (!base64String) {
                throw new Error("Empty base64 string in Nineteen AI response");
            }
            return `data:image/png;base64,${base64String}`;
        });

        return { success: true, data: base64s };
    },

    async [ModelProviderName.LIVEPEER](params: ImageGenerationParams, apiKey: string): Promise<ImageGenerationResult> {
        if (!apiKey) {
            throw new Error("Livepeer Gateway is not defined");
        }

        const baseUrl = new URL(apiKey);
        if (!baseUrl.protocol.startsWith("http")) {
            throw new Error("Invalid Livepeer Gateway URL protocol");
        }

        const response = await fetch(`${baseUrl.toString()}text-to-image`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer eliza-app-img",
            },
            body: JSON.stringify({
                model_id: params.modelId || "ByteDance/SDXL-Lightning",
                prompt: params.prompt,
                width: params.width || 1024,
                height: params.height || 1024,
            }),
        });

        const result = await response.json();
        if (!result.images?.length) {
            throw new Error("No images generated");
        }

        const base64Images = await Promise.all(
            result.images.map(async (image: { url: string }) => {
                const imageUrl = image.url.includes("http") ? image.url : `${apiKey}${image.url}`;
                return await convertUrlToBase64(imageUrl);
            })
        );

        return { success: true, data: base64Images };
    },

    async [ModelProviderName.OPENAI](params: ImageGenerationParams, apiKey: string, model: string): Promise<ImageGenerationResult> {
        let targetSize = `${params.width}x${params.height}`;
        if (!["1024x1024", "1792x1024", "1024x1792"].includes(targetSize)) {
            targetSize = "1024x1024";
        }

        const openai = new OpenAI({ apiKey });
        const response = await openai.images.generate({
            model,
            prompt: params.prompt,
            size: targetSize as "1024x1024" | "1792x1024" | "1024x1792",
            n: params.count,
            response_format: "b64_json",
        });

        const base64s = response.data.map(
            (image) => `data:image/png;base64,${image.b64_json}`
        );

        return { success: true, data: base64s };
    },
};

// Main Function
export const generateImage = async (
    params: ImageGenerationParams,
    runtime: IAgentRuntime
): Promise<ImageGenerationResult> => {
    try {
        const modelSettings = getImageModelSettings(runtime.imageModelProvider);
        const model = modelSettings.name;
        const apiKey = getApiKey(runtime, runtime.imageModelProvider);

        elizaLogger.info("Generating image with options:", {
            imageModelProvider: model,
        });

        const provider = providers[runtime.imageModelProvider];
        if (provider) {
            return await provider(params, apiKey, model);
        }

        // Default to OpenAI if no matching provider
        return await providers[ModelProviderName.OPENAI](params, apiKey, model);
    } catch (error) {
        elizaLogger.error('Image generation failed:', error);
        return { success: false, error };
    }
};

export const generateCaption = async (
    data: { imageUrl: string },
    runtime: IAgentRuntime
): Promise<{ title: string; description: string }> => {
    const imageDescriptionService = runtime.getService<IImageDescriptionService>(
        ServiceType.IMAGE_DESCRIPTION
    );
    
    if (!imageDescriptionService) {
        throw new Error("Image description service not found");
    }

    const resp = await imageDescriptionService.describeImage(data.imageUrl);
    return {
        title: resp.title.trim(),
        description: resp.description.trim(),
    };
};
