import { z, ZodError } from "zod";
import { IAgentRuntime } from "@elizaos/core";

const DEFAULT_LINKEDIN_API_URL = "https://api.linkedin.com";
const DEFAULT_LINKEDIN_POST_INTERVAL_MIN = 60;
const DEFAULT_LINKEDIN_POST_INTERVAL_MAX = 120;
const DEFAULT_LINKEDIN_DRY_RUN = false;

const parseNumber = (
    val: string | number | null,
    ctx: z.RefinementCtx,
    path: string
) => {
    const num = Number(val);

    if (Number.isNaN(num)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid number: ${val}`,
            path: [path],
        });
    }

    return num;
};

export const configSchema = z
    .object({
        LINKEDIN_ACCESS_TOKEN: z.string(),
        LINKEDIN_POST_INTERVAL_MIN: z
            .union([z.number(), z.string(), z.null(), z.undefined()])
            .transform((val, ctx) => {
                if (val === null || val === undefined) {
                    return DEFAULT_LINKEDIN_POST_INTERVAL_MIN;
                }
                return parseNumber(val, ctx, "LINKEDIN_POST_INTERVAL_MIN");
            }),
        LINKEDIN_POST_INTERVAL_MAX: z
            .union([z.number(), z.string(), z.null(), z.undefined()])
            .transform((val, ctx) => {
                if (val === null || val === undefined) {
                    return DEFAULT_LINKEDIN_POST_INTERVAL_MAX;
                }
                return parseNumber(val, ctx, "LINKEDIN_POST_INTERVAL_MAX");
            }),
        LINKEDIN_API_URL: z
            .union([z.string(), z.null(), z.undefined()])
            .transform((val) => val ?? DEFAULT_LINKEDIN_API_URL),
        LINKEDIN_DRY_RUN: z
            .union([z.string(), z.null(), z.undefined()])
            .transform((val) => {
                if (val === null || val === undefined) {
                    return DEFAULT_LINKEDIN_DRY_RUN;
                }

                return val === "true";
            }),
    })
    .superRefine((data, ctx) => {
        if (data.LINKEDIN_POST_INTERVAL_MIN > data.LINKEDIN_POST_INTERVAL_MAX) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Min value cannot be greater than max value",
                path: ["LINKEDIN_POST_INTERVAL_MIN"],
            });
        }
    });

export const validateConfig = (runtime: IAgentRuntime) => {
    try {
        const LINKEDIN_ACCESS_TOKEN = runtime.getSetting(
            "LINKEDIN_ACCESS_TOKEN"
        );
        const LINKEDIN_POST_INTERVAL_MIN = runtime.getSetting(
            "LINKEDIN_POST_INTERVAL_MIN"
        );
        const LINKEDIN_POST_INTERVAL_MAX = runtime.getSetting(
            "LINKEDIN_POST_INTERVAL_MAX"
        );
        const LINKEDIN_API_URL = runtime.getSetting("LINKEDIN_API_URL");
        const LINKEDIN_DRY_RUN = runtime.getSetting("LINKEDIN_DRY_RUN");

        const envs = configSchema.parse({
            LINKEDIN_ACCESS_TOKEN,
            LINKEDIN_POST_INTERVAL_MIN,
            LINKEDIN_POST_INTERVAL_MAX,
            LINKEDIN_API_URL,
            LINKEDIN_DRY_RUN,
        });

        return envs;
    } catch (error) {
        if (error instanceof ZodError) {
            throw new Error(
                `Invalid environment variables. Validating envs failed with error: ${error.issues
                    .map((issue) => issue.path.join(".") + ": " + issue.message)
                    .join(" , ")}`
            );
        } else {
            throw new Error("Invalid environment variables.");
        }
    }
};
