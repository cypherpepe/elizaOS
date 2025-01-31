import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ReadOnlyDiscourseClient } from "../client/ReadOnlyDiscourseClient";

describe("Posts from Discourse using Uniswap governance", () => {

    let client: ReadOnlyDiscourseClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new ReadOnlyDiscourseClient('https://gov.uniswap.org/');
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe("getLatestPosts", () => {
        it("should return posts", async () => {
            const posts = await client.getLatestPosts();
            expect(posts).toBeDefined();
            expect(posts.length).toBeGreaterThanOrEqual(0);
        });

        it("should return formatted posts", async () => {
            const posts = await client.getLatestPosts();
            expect(client.formatLatestPostsData(posts)).toBeDefined();
        })
    });
});