import { AxiosInstance, AxiosError } from "axios";
import {
    BasePostRequest,
    PostRequestWithMedia,
    API_VERSION_HEADER,
    API_VERSION,
    PublishPostParams,
} from "../interfaces";
import { prepareAxiosErrorMessage } from "../helpers/prepare-axios-error-message";

export class LinkedInPostPublisher {
    constructor(
        private readonly axios: AxiosInstance,
        readonly userId: string
    ) {}

    async publishPost({ postText, media }: PublishPostParams) {
        const requestBody = this.buildPostRequest({ postText, media });

        try {
            await this.axios.post("/rest/posts", requestBody, {
                headers: {
                    [API_VERSION_HEADER]: [API_VERSION],
                },
            });
        } catch (error) {
            const isAxiosError = error instanceof AxiosError;

            throw new Error(
                `Failed to publish LinkedIn post: ${isAxiosError ? prepareAxiosErrorMessage(error) : error}`
            );
        }
    }

    private buildPostRequest({
        postText,
        media,
    }: PublishPostParams): BasePostRequest | PostRequestWithMedia {
        const baseRequest: BasePostRequest = {
            author: `urn:li:person:${this.userId}`,
            commentary: postText,
            visibility: "PUBLIC",
            distribution: {
                feedDistribution: "MAIN_FEED",
                targetEntities: [],
                thirdPartyDistributionChannels: [],
            },
            lifecycleState: "PUBLISHED",
            isReshareDisabledByAuthor: false,
        };

        return media ? { ...baseRequest, content: { media } } : baseRequest;
    }
}
