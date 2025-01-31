import { describe, it, expect, vi } from 'vitest';
import { validateConfig, configSchema } from '../src/helpers/validate-config';
import { IAgentRuntime } from '@elizaos/core';

describe('validateConfig', () => {
    const mockRuntime = {
        getSetting: vi.fn(),
    } as unknown as IAgentRuntime;

    it('should validate correct config', () => {
        vi.mocked(mockRuntime.getSetting)
            .mockImplementation((key: string) => {
                const settings = {
                    LINKEDIN_ACCESS_TOKEN: 'test-token',
                    LINKEDIN_POST_INTERVAL_MIN: '60',
                    LINKEDIN_POST_INTERVAL_MAX: '120',
                    LINKEDIN_API_URL: 'https://api.linkedin.com',
                    LINKEDIN_DRY_RUN: 'false'
                };
                return settings[key];
            });

        const config = validateConfig(mockRuntime);

        expect(config).toEqual({
            LINKEDIN_ACCESS_TOKEN: 'test-token',
            LINKEDIN_POST_INTERVAL_MIN: 60,
            LINKEDIN_POST_INTERVAL_MAX: 120,
            LINKEDIN_API_URL: 'https://api.linkedin.com',
            LINKEDIN_DRY_RUN: false
        });
    });

    it('should throw error when access token is missing', () => {
        vi.mocked(mockRuntime.getSetting)
            .mockImplementation((key: string) => {
                const settings = {
                    LINKEDIN_POST_INTERVAL_MIN: '60',
                    LINKEDIN_POST_INTERVAL_MAX: '120'
                };
                return settings[key];
            });

        expect(() => validateConfig(mockRuntime))
            .toThrow('Invalid environment variables');
    });

    it('should throw error when min interval is greater than max', () => {
        vi.mocked(mockRuntime.getSetting)
            .mockImplementation((key: string) => {
                const settings = {
                    LINKEDIN_ACCESS_TOKEN: 'test-token',
                    LINKEDIN_POST_INTERVAL_MIN: '150',
                    LINKEDIN_POST_INTERVAL_MAX: '120'
                };
                return settings[key];
            });

        expect(() => validateConfig(mockRuntime))
            .toThrow('Min value cannot be greater than max value');
    });

    it('should use default values when optional settings are missing', () => {
        vi.mocked(mockRuntime.getSetting)
            .mockImplementation((key: string) => {
                const settings = {
                    LINKEDIN_ACCESS_TOKEN: 'test-token'
                };
                return settings[key];
            });

        const config = validateConfig(mockRuntime);

        expect(config).toEqual({
            LINKEDIN_ACCESS_TOKEN: 'test-token',
            LINKEDIN_POST_INTERVAL_MIN: 60,
            LINKEDIN_POST_INTERVAL_MAX: 120,
            LINKEDIN_API_URL: 'https://api.linkedin.com',
            LINKEDIN_DRY_RUN: false
        });
    });

    it('should handle non-ZodError errors', () => {
        vi.mocked(mockRuntime.getSetting).mockImplementation(() => {
            throw new Error('Unexpected runtime error');
        });

        expect(() => validateConfig(mockRuntime))
            .toThrow('Invalid environment variables.');
    });

    describe('parseNumber validation', () => {
        it('should parse valid string numbers', () => {
            const result = configSchema.parse({
                LINKEDIN_ACCESS_TOKEN: 'test-token',
                LINKEDIN_POST_INTERVAL_MIN: '42',
                LINKEDIN_POST_INTERVAL_MAX: '120'
            });

            expect(result.LINKEDIN_POST_INTERVAL_MIN).toBe(42);
        });

        it('should parse actual numbers', () => {
            const result = configSchema.parse({
                LINKEDIN_ACCESS_TOKEN: 'test-token',
                LINKEDIN_POST_INTERVAL_MIN: 42,
                LINKEDIN_POST_INTERVAL_MAX: 120
            });

            expect(result.LINKEDIN_POST_INTERVAL_MIN).toBe(42);
        });

        it('should throw error for invalid number strings', () => {
            expect(() => configSchema.parse({
                LINKEDIN_ACCESS_TOKEN: 'test-token',
                LINKEDIN_POST_INTERVAL_MIN: 'not-a-number',
                LINKEDIN_POST_INTERVAL_MAX: '120'
            })).toThrow('Invalid number: not-a-number');
        });

        it('should handle decimal strings', () => {
            const result = configSchema.parse({
                LINKEDIN_ACCESS_TOKEN: 'test-token',
                LINKEDIN_POST_INTERVAL_MIN: '42.5',
                LINKEDIN_POST_INTERVAL_MAX: '120'
            });

            expect(result.LINKEDIN_POST_INTERVAL_MIN).toBe(42.5);
        });
    });
});
