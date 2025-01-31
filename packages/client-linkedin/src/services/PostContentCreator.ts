import {
    composeContext,
    generateText,
    IAgentRuntime,
    ModelClass,
    stringToUuid,
} from "@elizaos/core";
import { createLinkedinPostTemplate } from "../templates";
import removeMd from "remove-markdown";

export class PostContentCreator {
    constructor(public runtime: IAgentRuntime) {}

    async createPostContent(userId: string) {
        const roomId = stringToUuid("linkedin_generate_room-" + userId);
        const topics = this.runtime.character.topics.join(", ");

        const state = await this.runtime.composeState({
            userId: this.runtime.agentId,
            roomId: roomId,
            agentId: this.runtime.agentId,
            content: {
                text: topics || "",
                action: "LINKEDIN_POST",
            },
        });

        const context = composeContext({
            state,
            template: createLinkedinPostTemplate,
        });

        const text = await generateText({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        return this.removeMd(this.escapeSpecialCharacters(text));
    }

    removeMd(content: string) {
        return removeMd(content);
    }

    escapeSpecialCharacters(content: string): string {
        const escapedCharacters = content
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)")
            .replace(/\[/g, "\\[")
            .replace(/\]/g, "\\]")
            .replace(/\{/g, "\\{")
            .replace(/\}/g, "\\}");

        return escapedCharacters;
    }
}
