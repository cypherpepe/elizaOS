import { AxiosInstance, AxiosError } from "axios";
import { API_VERSION, API_VERSION_HEADER, MediaUploadUrl } from "../interfaces";
import { prepareAxiosErrorMessage } from "../helpers/prepare-axios-error-message";

export class LinkedInFileUploader {
    constructor(
        private readonly axios: AxiosInstance,
        readonly userId: string
    ) {}

    async uploadAsset(imageBlob: Blob) {
        const { uploadUrl, imageId } = await this.createMediaUploadUrl();
        await this.uploadMedia(uploadUrl, imageBlob);

        return imageId;
    }

    async createMediaUploadUrl() {
        try {
            const initResponse = await this.axios.post<MediaUploadUrl>(
                "/rest/images",
                {
                    initializeUploadRequest: {
                        owner: `urn:li:person:${this.userId}`,
                    },
                },
                {
                    headers: {
                        [API_VERSION_HEADER]: [API_VERSION],
                    },
                    params: {
                        action: "initializeUpload",
                    },
                }
            );

            return {
                uploadUrl: initResponse.data.value.uploadUrl,
                imageId: initResponse.data.value.image,
            };
        } catch (error) {
            const isAxiosError = error instanceof AxiosError;

            throw new Error(
                `Failed create media upload url: ${isAxiosError ? prepareAxiosErrorMessage(error) : error}`
            );
        }
    }

    async uploadMedia(uploadUrl: string, imageBlob: Blob) {
        try {
            await this.axios.put(uploadUrl, imageBlob, {
                headers: {
                    "Content-Type": "application/octet-stream",
                },
            });
        } catch (error) {
            const isAxiosError = error instanceof AxiosError;

            throw new Error(
                `Failed to upload media: ${isAxiosError ? prepareAxiosErrorMessage(error) : error}`
            );
        }
    }
}
