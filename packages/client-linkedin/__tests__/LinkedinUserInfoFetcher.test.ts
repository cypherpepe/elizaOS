import { describe, it, expect, vi } from 'vitest';
import { LinkedInUserInfoFetcher } from '../src/repositories/LinkedinUserInfoFetcher';
import { AxiosInstance, AxiosError } from 'axios';
import { UserInfo } from '../src/interfaces';

describe('LinkedInUserInfoFetcher', () => {
    const mockAxios = {
        get: vi.fn(),
    } as unknown as AxiosInstance;

    const fetcher = new LinkedInUserInfoFetcher(mockAxios);

    it('should fetch user info successfully', async () => {
        const mockUserInfo: UserInfo = {
            sub: 'user123',
            email: 'test@example.com',
            email_verified: true,
            name: 'Test User',
            locale: { country: 'US', language: 'en_US' },
            given_name: 'Test',
            family_name: 'User',
            picture: 'https://example.com/picture.jpg'
        };

        vi.mocked(mockAxios.get).mockResolvedValueOnce({
            data: mockUserInfo
        });

        const result = await fetcher.getUserInfo();

        expect(mockAxios.get).toHaveBeenCalledWith('/v2/userinfo');
        expect(result).toEqual(mockUserInfo);
    });

    it('should handle axios error', async () => {
        const error = new AxiosError(
            'Network Error',
            'ERR_NETWORK',
            undefined,
            undefined,
            {
                status: 401,
                data: { message: 'Unauthorized' },
            } as any
        );

        vi.mocked(mockAxios.get).mockRejectedValueOnce(error);

        await expect(fetcher.getUserInfo())
            .rejects
            .toThrow('Failed to fetch user info');
    });

    it('should handle non-axios error', async () => {
        const error = new Error('Unexpected error');
        vi.mocked(mockAxios.get).mockRejectedValueOnce(error);

        await expect(fetcher.getUserInfo())
            .rejects
            .toThrow('Failed to fetch user info: Error: Unexpected error');
    });
});
