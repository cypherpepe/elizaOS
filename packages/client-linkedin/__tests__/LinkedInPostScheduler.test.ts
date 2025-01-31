import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LinkedInPostScheduler } from "../src/services/LinkedInPostScheduler";
import { LinkedInPostPublisher } from "../src/repositories/LinkedinPostPublisher";
import { LinkedInUserInfoFetcher } from "../src/repositories/LinkedinUserInfoFetcher";
import { PostContentCreator } from "../src/services/PostContentCreator";
import { IAgentRuntime } from "@elizaos/core";
import { PublisherConfig } from "../src/interfaces";
import axios from "axios";

vi.mock("../src/repositories/LinkedinPostPublisher");
vi.mock("../src/services/PostContentCreator");
vi.useFakeTimers();

describe("LinkedInPostScheduler", () => {
    let mockRuntime: IAgentRuntime;
    let mockPostPublisher: LinkedInPostPublisher;
    let mockPostContentCreator: PostContentCreator;
    let mockUserInfoFetcher: LinkedInUserInfoFetcher;
    let config: PublisherConfig;

    beforeEach(() => {
        mockRuntime = {
            cacheManager: {
                get: vi.fn(),
                set: vi.fn(),
            },
            messageManager: {
                createMemory: vi.fn(),
            },
            agentId: "test-agent-id",
        } as unknown as IAgentRuntime;

        mockPostPublisher = new LinkedInPostPublisher(axios.create(), "test-user");
        vi.spyOn(mockPostPublisher, 'publishPost');

        mockPostContentCreator = new PostContentCreator(mockRuntime);
        vi.spyOn(mockPostContentCreator, 'createPostContent');

        mockUserInfoFetcher = {
            getUserInfo: vi.fn().mockResolvedValue({ sub: "test-user" }),
        } as unknown as LinkedInUserInfoFetcher;

        config = {
            LINKEDIN_POST_INTERVAL_MIN: 60,
            LINKEDIN_POST_INTERVAL_MAX: 120,
            LINKEDIN_DRY_RUN: false,
        };
    });

    describe("createPostScheduler", () => {
        it("should create a new instance of LinkedInPostScheduler", async () => {
            const scheduler = await LinkedInPostScheduler.createPostScheduler({
                axiosInstance: axios.create(),
                userInfoFetcher: mockUserInfoFetcher,
                runtime: mockRuntime,
                config,
            });

            expect(scheduler).toBeInstanceOf(LinkedInPostScheduler);
            expect(mockUserInfoFetcher.getUserInfo).toHaveBeenCalled();
        });
    });

    describe("createPostPublicationLoop", () => {
        let scheduler: LinkedInPostScheduler;

        beforeEach(() => {
            scheduler = new LinkedInPostScheduler(
                mockRuntime,
                mockPostPublisher,
                mockPostContentCreator,
                "test-user",
                config
            );
        });

        it("should publish post when enough time has passed", async () => {
            vi.spyOn(mockRuntime.cacheManager, 'get').mockResolvedValue(null);
            vi.spyOn(mockPostContentCreator, 'createPostContent').mockResolvedValue("Test post content");
            vi.spyOn(mockPostPublisher, 'publishPost').mockResolvedValue();

            await scheduler.createPostPublicationLoop();

            expect(mockPostContentCreator.createPostContent).toHaveBeenCalledWith("test-user");
            expect(mockPostPublisher.publishPost).toHaveBeenCalledWith({
                postText: "Test post content",
            });
            expect(mockRuntime.cacheManager.set).toHaveBeenCalled();
            expect(mockRuntime.messageManager.createMemory).toHaveBeenCalled();
        });

        it("should not publish post when in dry run mode", async () => {
            const dryRunConfig = { ...config, LINKEDIN_DRY_RUN: true };
            scheduler = new LinkedInPostScheduler(
                mockRuntime,
                mockPostPublisher,
                mockPostContentCreator,
                "test-user",
                dryRunConfig
            );

            vi.spyOn(mockRuntime.cacheManager, 'get').mockResolvedValue(null);
            vi.spyOn(mockPostContentCreator, 'createPostContent').mockResolvedValue("Test post content");

            await scheduler.createPostPublicationLoop();

            expect(mockPostContentCreator.createPostContent).toHaveBeenCalled();
            expect(mockPostPublisher.publishPost).not.toHaveBeenCalled();
        });

        it("should not publish post when not enough time has passed", async () => {
            const currentTime = Date.now();
            vi.spyOn(mockRuntime.cacheManager, 'get').mockResolvedValue({
                timestamp: currentTime,
            });

            await scheduler.createPostPublicationLoop();

            expect(mockPostContentCreator.createPostContent).not.toHaveBeenCalled();
            expect(mockPostPublisher.publishPost).not.toHaveBeenCalled();
        });

        it("should schedule next execution", async () => {
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
            vi.spyOn(mockRuntime.cacheManager, 'get').mockResolvedValue(null);
            vi.spyOn(mockPostContentCreator, 'createPostContent').mockResolvedValue("Test post content");

            await scheduler.createPostPublicationLoop();

            expect(setTimeoutSpy).toHaveBeenCalled();
        });
    });
});
