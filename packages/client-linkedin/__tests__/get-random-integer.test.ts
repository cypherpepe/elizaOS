import { describe, it, expect } from 'vitest';
import { getRandomInteger } from '../src/helpers/get-random-integer';

describe('getRandomInteger', () => {
    it('should return a number between min and max inclusive', () => {
        const min = 1;
        const max = 10;
        const result = getRandomInteger(min, max);

        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
        expect(Number.isInteger(result)).toBe(true);
    });

    it('should work with same min and max values', () => {
        const result = getRandomInteger(5, 5);
        expect(result).toBe(5);
    });

    it('should throw error when min is greater than max', () => {
        expect(() => getRandomInteger(10, 1)).toThrow('Min value cannot be greater than max value');
    });

    it('should throw error for NaN values', () => {
        expect(() => getRandomInteger(NaN, 10)).toThrow('Invalid range: min and max must be valid numbers');
        expect(() => getRandomInteger(1, NaN)).toThrow('Invalid range: min and max must be valid numbers');
        expect(() => getRandomInteger(NaN, NaN)).toThrow('Invalid range: min and max must be valid numbers');
    });
});
