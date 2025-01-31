import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { prepareAxiosErrorMessage } from '../src/helpers/prepare-axios-error-message';

describe('prepareAxiosErrorMessage', () => {
    it('should format error with all fields', () => {
        const mockError = new AxiosError(
            'Network Error',
            'ERR_NETWORK',
            undefined,
            undefined,
            {
                status: 404,
                data: { error: 'Not Found' },
            } as any
        );

        const result = prepareAxiosErrorMessage(mockError);
        const parsed = JSON.parse(result);

        expect(parsed).toEqual({
            message: 'Network Error',
            status: 404,
            data: { error: 'Not Found' },
            code: 'ERR_NETWORK'
        });
    });

    it('should handle error without response data', () => {
        const mockError = new AxiosError(
            'Timeout Error',
            'ECONNABORTED'
        );

        const result = prepareAxiosErrorMessage(mockError);
        const parsed = JSON.parse(result);

        expect(parsed).toEqual({
            message: 'Timeout Error',
            status: undefined,
            data: undefined,
            code: 'ECONNABORTED'
        });
    });
});
