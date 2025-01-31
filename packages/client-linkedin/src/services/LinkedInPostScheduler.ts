import { AxiosInstance } from "axios";
import { LinkedInUserInfoFetcher } from "../repositories/LinkedinUserInfoFetcher";
import { PostContentCreator } from "./PostContentCreator";
import { elizaLogger, IAgentRuntime, stringToUuid } from "@elizaos/core";
import { getRandomInteger } from "../helpers/get-random-integer";
import { LinkedInPostPublisher } from "../repositories/LinkedinPostPublisher";
import { PublisherConfig } from "../interfaces";

export class LinkedInPostScheduler {
    constructor(
        private runtime: IAgentRuntime,
        private postPublisher: LinkedInPostPublisher,
        private postContentCreator: PostContentCreator,
        readonly userId: string,
        readonly config: PublisherConfig
    ) {}

    static async createPostScheduler({
        axiosInstance,
        userInfoFetcher,
        runtime,
        config,
    }: {
        axiosInstance: AxiosInstance;
        userInfoFetcher: LinkedInUserInfoFetcher;
        runtime: IAgentRuntime;
        config: PublisherConfig;
    }) {
        const userInfo = await userInfoFetcher.getUserInfo();

        const postPublisher = new LinkedInPostPublisher(
            axiosInstance,
            userInfo.sub
        );
        const postContentCreator = new PostContentCreator(runtime);

        return new LinkedInPostScheduler(
            runtime,
            postPublisher,
            postContentCreator,
            userInfo.sub,
            config
        );
    }

    async createPostPublicationLoop() {
        const lastPost = await this.runtime.cacheManager.get<{
            timestamp: number;
        }>("linkedin/" + this.userId + "/lastPost");

        const lastPostTimestamp = lastPost?.timestamp ?? 0;
        const minMinutes = this.config.LINKEDIN_POST_INTERVAL_MIN;
        const maxMinutes = this.config.LINKEDIN_POST_INTERVAL_MAX;

        const randomMinutes = getRandomInteger(minMinutes, maxMinutes);
        const delay = randomMinutes * 60 * 1000;

        if (Date.now() > lastPostTimestamp + delay) {
            const postText = await this.postContentCreator.createPostContent(
                this.userId
            );

            elizaLogger.log(`Generated post text`);
            elizaLogger.log(postText);

            if (!this.config.LINKEDIN_DRY_RUN) {
                await this.postPublisher.publishPost({ postText });
                elizaLogger.info("Published post");
            } else {
                elizaLogger.warn(
                    "Dry run is enabled. To publish posts set LINKEDIN_DRY_RUN to false"
                );
            }

            this.runtime.messageManager.createMemory({
                userId: this.runtime.agentId,
                agentId: this.runtime.agentId,
                roomId: stringToUuid("linkedin_generate_room-" + this.userId),
                content: {
                    text: postText,
                },
            });

            await this.runtime.cacheManager.set(
                "linkedin/" + this.userId + "/lastPost",
                { timestamp: Date.now() }
            );
        }

        setTimeout(() => {
            this.createPostPublicationLoop();
        }, delay);
    }
}
