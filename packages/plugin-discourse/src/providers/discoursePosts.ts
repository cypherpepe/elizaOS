import type { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

import { validateDiscourseConfig } from "../enviroment";
import { ReadOnlyDiscourseClient } from "../client/ReadOnlyDiscourseClient";

// Provider that focuses on getting the latest posts from a Discourse instance and formatting them for the agent
const discoursePostsProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State,
    ): Promise<string | null> => {
        try {
            // Extract and validate the Discourse configuration from the runtime context
            const config = await validateDiscourseConfig(runtime);
            const client = new ReadOnlyDiscourseClient(config.DISCOURSE_INSTANCE_URL);

            // Make the API call to get the latest posts
            const posts = await client.getLatestPosts();

            // Return the formatted post data as a string
            return client.formatLatestPostsData(posts);
        } catch (error) {
            console.error("Error in discourse provider:", error);
            return "Error fetching posts from the Discourse instance - report this to the user and get the dev on the line";
        }
    },
};

// Module exports
export { discoursePostsProvider };
