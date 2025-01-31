import axios, { type AxiosInstance } from "axios";
import { Post } from "../types/Post";

export class ReadOnlyDiscourseClient {
    instance: AxiosInstance;

    constructor(instanceUrl: string) {
        // Removing any trailing slash on the instance URL
        const trimmedInstanceUrl = instanceUrl.replace(
            /\/$/,
            "",
        );

        // Creating the axios instance with the base URL injected
        this.instance = axios.create({ baseURL: trimmedInstanceUrl });
    }

    async getLatestPosts(): Promise<Post[]> {
        const response = await this.instance.get("/posts", {
            headers: {
                accept: "application/json",
            },
        });

        // Validate the posts response
        const posts = response.data;
        if (
            !posts.latest_posts ||
            !posts.latest_posts.length ||
            posts.latest_posts.length === 0
        ) {
            throw new Error("No post data found");
        }

        return posts.latest_posts as Post[];
    }

    formatLatestPostsData(posts: Post[]) {
        return posts
            .map((post) => {
                return `Post ID: ${post.id}\nCreated At: ${post.created_at}\nUsername: ${post.username}\nRaw: ${post.raw}\n\n`;
            })
            .join("");
    }

}