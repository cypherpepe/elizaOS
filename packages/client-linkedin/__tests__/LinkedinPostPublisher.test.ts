import { describe, it, expect, vi } from 'vitest';
import { LinkedInPostPublisher } from '../src/repositories/LinkedinPostPublisher';
import { AxiosInstance, AxiosError } from 'axios';
import { API_VERSION, API_VERSION_HEADER } from '../src/interfaces';

describe('LinkedInPostPublisher', () => {
    const mockAxios = {
        post: vi.fn(),
    } as unknown as AxiosInstance;

    const userId = 'test-user-id';
    const publisher = new LinkedInPostPublisher(mockAxios, userId);

    it('should publish text-only post successfully', async () => {
        const postText = 'Test post content';

        await publisher.publishPost({ postText });

        expect(mockAxios.post).toHaveBeenCalledWith(
            '/rest/posts',
            {
                author: `urn:li:person:${userId}`,
                commentary: postText,
                visibility: 'PUBLIC',
                distribution: {
                    feedDistribution: 'MAIN_FEED',
                    targetEntities: [],
                    thirdPartyDistributionChannels: [],
                },
                lifecycleState: 'PUBLISHED',
                isReshareDisabledByAuthor: false,
            },
            {
                headers: {
                    [API_VERSION_HEADER]: [API_VERSION],
                },
            }
        );
    });

    it('should publish post with media successfully', async () => {
        const postText = 'Test post with media';
        const media = { id: 'media-id', title: 'media-title' };

        await publisher.publishPost({ postText, media });

        expect(mockAxios.post).toHaveBeenCalledWith(
            '/rest/posts',
            {
                author: `urn:li:person:${userId}`,
                commentary: postText,
                visibility: 'PUBLIC',
                distribution: {
                    feedDistribution: 'MAIN_FEED',
                    targetEntities: [],
                    thirdPartyDistributionChannels: [],
                },
                lifecycleState: 'PUBLISHED',
                isReshareDisabledByAuthor: false,
                content: { media },
            },
            {
                headers: {
                    [API_VERSION_HEADER]: [API_VERSION],
                },
            }
        );
    });

    it('should handle axios error', async () => {
        const error = new AxiosError(
            'Network Error',
            'ERR_NETWORK',
            undefined,
            undefined,
            {
                status: 500,
                data: { message: 'Internal Server Error' },
            } as any
        );

        vi.mocked(mockAxios.post).mockRejectedValueOnce(error);

        await expect(publisher.publishPost({ postText: 'Test post' }))
            .rejects
            .toThrow('Failed to publish LinkedIn post');
    });

    it('should handle non-axios error', async () => {
        const error = new Error('Unexpected error');
        vi.mocked(mockAxios.post).mockRejectedValueOnce(error);

        await expect(publisher.publishPost({ postText: 'Test post' }))
            .rejects
            .toThrow('Failed to publish LinkedIn post: Error: Unexpected error');
    });
});
