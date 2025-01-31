import { describe, it, expect, vi } from 'vitest';
import { LinkedInFileUploader } from '../src/repositories/LinkedinFileUploader';
import { AxiosInstance, AxiosError } from 'axios';
import { API_VERSION, API_VERSION_HEADER } from '../src/interfaces';

describe('LinkedInFileUploader', () => {
    const mockAxios = {
        post: vi.fn(),
        put: vi.fn(),
    } as unknown as AxiosInstance;

    const userId = 'test-user-id';
    const uploader = new LinkedInFileUploader(mockAxios, userId);

    it('should upload asset successfully', async () => {
        const mockUploadUrl = 'https://example.com/upload';
        const mockImageId = 'image123';
        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

        vi.mocked(mockAxios.post).mockResolvedValueOnce({
            data: {
                value: {
                    uploadUrl: mockUploadUrl,
                    image: mockImageId,
                    uploadUrlExpiresAt: Date.now() + 3600000,
                },
            },
        });

        vi.mocked(mockAxios.put).mockResolvedValueOnce({});

        const result = await uploader.uploadAsset(mockBlob);

        expect(mockAxios.post).toHaveBeenCalledWith(
            '/rest/images',
            {
                initializeUploadRequest: {
                    owner: `urn:li:person:${userId}`,
                },
            },
            {
                headers: {
                    [API_VERSION_HEADER]: [API_VERSION],
                },
                params: {
                    action: 'initializeUpload',
                },
            }
        );

        expect(mockAxios.put).toHaveBeenCalledWith(
            mockUploadUrl,
            mockBlob,
            {
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
            }
        );

        expect(result).toBe(mockImageId);
    });

    it('should handle create upload url error', async () => {
        const error = new AxiosError(
            'Network Error',
            'ERR_NETWORK',
            undefined,
            undefined,
            {
                status: 500,
                data: { message: 'Server Error' },
            } as any
        );

        vi.mocked(mockAxios.post).mockRejectedValueOnce(error);

        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

        await expect(uploader.uploadAsset(mockBlob))
            .rejects
            .toThrow('Failed create media upload url');
    });

    it('should handle upload media error', async () => {
        const mockUploadUrl = 'https://example.com/upload';
        const mockImageId = 'image123';
        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

        vi.mocked(mockAxios.post).mockResolvedValueOnce({
            data: {
                value: {
                    uploadUrl: mockUploadUrl,
                    image: mockImageId,
                    uploadUrlExpiresAt: Date.now() + 3600000,
                },
            },
        });

        const error = new Error('Upload failed');
        vi.mocked(mockAxios.put).mockRejectedValueOnce(error);

        await expect(uploader.uploadAsset(mockBlob))
            .rejects
            .toThrow('Failed to upload media: Error: Upload failed');
    });
});
