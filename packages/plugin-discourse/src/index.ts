import type { Plugin } from "@elizaos/core";
import { discoursePostsProvider } from "./providers/discoursePosts.ts";

export const discoursePlugin: Plugin = {
    name: "discourse",
    description: "Discourse Plugin for Eliza",
    actions: [],
    evaluators: [],
    providers: [discoursePostsProvider],
};

export default discoursePlugin;
