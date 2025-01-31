import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateImage } from "../src/generation";
import { ModelProviderName } from "../src/types";
import type { AgentRuntime } from "../src/runtime";

describe("Image Generation", () => {
    let mockRuntime: AgentRuntime;

    beforeEach(() => {
        global.fetch = vi.fn();
        mockRuntime = {
            imageModelProvider: ModelProviderName.IDEOGRAM,
            getSetting: vi.fn((key: string) => {
                switch (key) {
                    case "IDEOGRAM_API_KEY":
                        return "test-api-key";
                    case "IDEOGRAM_MAGIC_PROMPT":
                        return "auto";
                    case "IDEOGRAM_STYLE_TYPE":
                        return "auto";
                    case "IDEOGRAM_COLOR_PALETTE":
                        return "vibrant";
                    case "IDEOGRAM_MODEL":
                        return "V_2";
                    default:
                        return undefined;
                }
            }),
        } as unknown as AgentRuntime;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("Ideogram.ai Integration", () => {
        it("should generate an image successfully", async () => {
            const mockImageUrl = "https://example.com/image.jpg";
            const mockBase64 = "base64-encoded-image";
            
            // Mock the initial API call
            (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [{ url: mockImageUrl }],
                        }),
                })
            );

            // Mock the image fetch call
            (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    blob: () =>
                        Promise.resolve(
                            new Blob(["mock-image-data"], {
                                type: "image/jpeg",
                            })
                        ),
                })
            );

            const result = await generateImage(
                {
                    prompt: "A beautiful sunset",
                    width: 1024,
                    height: 1024,
                    count: 1,
                    negativePrompt: "blur, dark",
                    seed: 12345,
                },
                mockRuntime
            );

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.length).toBe(1);
            expect(result.data?.[0]).toContain("data:image/jpeg;base64,");

            // Verify the API call
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(fetch).toHaveBeenNthCalledWith(
                1,
                "https://api.ideogram.ai/generate",
                {
                    method: "POST",
                    headers: {
                        "Api-Key": "test-api-key",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        image_request: {
                            prompt: "A beautiful sunset",
                            model: "V_2",
                            magic_prompt_option: "AUTO",
                            style_type: "AUTO",
                            resolution: "RESOLUTION_1024_1024",
                            num_images: 1,
                            negative_prompt: "blur, dark",
                            color_palette: {
                                name: "VIBRANT"
                            },
                            seed: 12345,
                        },
                    }),
                }
            );
        });

        it("should handle API errors gracefully", async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    statusText: "Bad Request",
                    json: () =>
                        Promise.resolve({
                            error: "Invalid request",
                        }),
                })
            );

            const result = await generateImage(
                {
                    prompt: "A beautiful sunset",
                    width: 1024,
                    height: 1024,
                },
                mockRuntime
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toMatch(/Failed to generate image/);
        });

        it("should handle empty response data", async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [],
                        }),
                })
            );

            const result = await generateImage(
                {
                    prompt: "A beautiful sunset",
                    width: 1024,
                    height: 1024,
                },
                mockRuntime
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toBe("No images generated");
        });

        it("should handle missing image URL", async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [{ }],
                        }),
                })
            );

            const result = await generateImage(
                {
                    prompt: "A beautiful sunset",
                    width: 1024,
                    height: 1024,
                },
                mockRuntime
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toBe("Empty base64 string in Ideogram AI response");
        });

        it("should handle image fetch errors", async () => {
            (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [{ url: "https://example.com/image.jpg" }],
                        }),
                })
            );

            (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    statusText: "Not Found",
                })
            );

            const result = await generateImage(
                {
                    prompt: "A beautiful sunset",
                    width: 1024,
                    height: 1024,
                },
                mockRuntime
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toBe("Failed to fetch image: Not Found");
        });
    });
}); 