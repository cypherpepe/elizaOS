import {
    elizaLogger,
    Client as ElizaClient,
    IAgentRuntime,
    stringToUuid,
    Content,
    Memory,
    State,
    generateShouldRespond,
    getEmbeddingZeroVector,
    composeContext,
    ModelClass,
    generateMessageResponse,
} from "@elizaos/core";

import { EventEmitter } from "events";
import { GoogleClient } from "./google_client";
import { google } from "googleapis";
import { cleanEmailText, extractEmailText, isCalendarInvite } from "./mail";

import {
    gmailMessageHandlerTemplate,
    gmailShouldRespondTemplate,
} from "./templates";

const POOLING_INTERVAL = 30; // Check for emails every 30 seconds

export class GmailClient extends EventEmitter {
    private googleClient: GoogleClient;
    private emailCheckInterval: NodeJS.Timeout;
    private runtime: IAgentRuntime;

    constructor(runtime: IAgentRuntime) {
        elizaLogger.success("Starting gmail client", runtime.agentId);
        super();
        this.runtime = runtime;
        this.initialize();
    }

    private async initialize() {
        this.googleClient = new GoogleClient(this.runtime);

        // Start polling for unread emails
        this.emailCheckInterval = setInterval(() => {
            this.checkEmails().catch((error) => {
                elizaLogger.error("Error checking unread emails:", error);
                elizaLogger.error(error.stack);
            });
        }, POOLING_INTERVAL * 1000);
    }

    async stop() {
        this.googleClient.close();
        clearInterval(this.emailCheckInterval);
    }

    async checkEmails() {
        if (!this.googleClient.authenticated) {
            return;
        }

        const gmail = google.gmail({
            version: "v1",
            auth: this.googleClient.oAuth2Client,
        });
        const res = await gmail.users.messages.list({
            userId: "me",
            maxResults: 10,
            q: "in:inbox",
        });
        const messages = res.data.messages;
        if (messages == undefined) {
            elizaLogger.debug("Gmail: No messages found");
            return;
        }

        elizaLogger.success("Gmail: Found " + messages.length + " email(s)");

        // For each email, process email
        for (const message of messages) {
            await this.processEmail(message);
        }
    }

    async processEmail(message: any) {
        // Getting email details
        console.log("🔍 Step 1: Get message details");
        const gmail = google.gmail({
            version: "v1",
            auth: this.googleClient.oAuth2Client,
        });
        const email = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
        });
        const emailId = email.data.id;
        const emailThreadId = email.data.threadId;
        const emailFrom = email.data.payload.headers.find(
            (header: any) => header.name === "From"
        ).value;
        const emailFromAddress = emailFrom.split("<")[1].split(">")[0];
        let emailFromName = emailFrom.split("<")[0].trim();
        if (emailFromName == "") {
            emailFromName = emailFromAddress;
        }
        const emailDateStr = email.data.payload.headers.find(
            (header: any) => header.name === "Date"
        ).value;
        const emailDate = new Date(emailDateStr);
        elizaLogger.success("Processing email: ", emailId, "from: ", emailFrom);

        // Extract text
        console.log("Step 2: Extract text");
        const mailText = extractEmailText(email);

        // Clean the message text
        console.log("🧹 Step 3: Cleaning message text");
        const cleanedText = cleanEmailText(mailText);

        // Generate unique IDs
        console.log("🔑 Step 4: Generating conversation IDs");
        const roomId = stringToUuid(emailThreadId);
        const userId = stringToUuid(
            `${emailFromAddress}-${this.runtime.agentId}`
        );
        const messageId = stringToUuid(emailId);

        // Ensure both the sender and agent are properly set up in the room
        await this.runtime.ensureConnection(
            userId,
            roomId,
            emailFromName,
            emailFromAddress,
            "gmail"
        );

        // Create initial memory
        console.log("💾 Step 5: Creating initial memory");
        const content: Content = {
            text: cleanedText,
            source: "gmail",
            inReplyTo: roomId,
            attachments: [
                {
                    id: messageId,
                    url: "", // Since this is text content, no URL is needed
                    title: "Text Attachment",
                    source: "gmail",
                    description: "Text content from email message",
                    text: cleanedText,
                },
            ],
        };

        const memory: Memory = {
            id: messageId,
            userId,
            agentId: this.runtime.agentId,
            roomId,
            content,
            createdAt: emailDate.getTime(),
            embedding: getEmbeddingZeroVector(),
        };

        // Add memory
        if (content.text) {
            console.log("💾 Step 6: Saving initial memory: ", messageId);
            await this.runtime.messageManager.createMemory(memory);
        }

        // Initial state composition
        console.log("🔄 Step 7: Composing initial state");
        let state = await this.runtime.composeState(
            { content, userId, agentId: this.runtime.agentId, roomId },
            {
                agentName: this.runtime.character.name,
                senderName: emailFrom,
            }
        );

        // Update state with recent messages
        console.log("🔄 Step 8: Updating state with recent messages");
        state = await this.runtime.updateRecentMessageState(state);

        // Check if we should respond
        console.log("🤔 Step 9: Checking if we should respond");
        const shouldRespond = await this._shouldRespond(email, state);

        if (!shouldRespond) {
            // Archive email
            await this.archiveEmail(emailId);
            return;
        }

        console.log("🤔 Step 10: Responding to email");

        const context = composeContext({
            state,
            template:
                this.runtime.character.templates?.gmailMessageHandlerTemplate ||
                gmailMessageHandlerTemplate,
        });

        const responseContent = await this._generateResponse(
            memory,
            state,
            context
        );

        console.log("Response content: ", responseContent);

        if (responseContent?.text) {
            console.log("📤 Step 11: Send email response");

            await this.replyAndArchiveEmail(emailId, responseContent?.text);
        }

        if (responseContent.action) {
            // console.log("⚡ Step 12: Processing actions");
            // await this.runtime.processActions(
            //     memory,
            //     responseMessages,
            //     state,
            //     callback
            // );
        }
    }

    private async _shouldRespond(email: any, state: State): Promise<boolean> {
        console.log("\n=== SHOULD_RESPOND PHASE ===");
        console.log("🔍 Step 1: Evaluating if should respond to message");

        // Check if it's a calendar invite
        if (isCalendarInvite(email)) {
            console.log("✅ Calendar invite detected - will NOT respond");
            return false;
        }

        // Check if we're in a thread and we've participated
        if (state.recentMessages?.includes(this.runtime.agentId)) {
            console.log("✅ Active thread participant - will respond");
            return true;
        }

        // Only use LLM for ambiguous cases
        console.log("🤔 Step 2: Using LLM to decide response");
        const shouldRespondContext = composeContext({
            state,
            template:
                this.runtime.character.templates?.gmailShouldRespondTemplate ||
                this.runtime.character.templates?.shouldRespondTemplate ||
                gmailShouldRespondTemplate,
        });

        console.log("🔄 Step 3: Calling generateShouldRespond");
        const response = await generateShouldRespond({
            runtime: this.runtime,
            context: shouldRespondContext,
            modelClass: ModelClass.SMALL,
        });

        console.log(`✅ Step 4: LLM decision received: ${response}`);
        return response === "RESPOND";
    }

    private async _generateResponse(
        memory: Memory,
        state: State,
        context: string
    ): Promise<Content> {
        console.log("\n=== GENERATE_RESPONSE PHASE ===");
        console.log("🔍 Step 1: Starting response generation");

        // Generate response only once
        console.log("🔄 Step 2: Calling LLM for response");
        const response = await generateMessageResponse({
            runtime: this.runtime,
            context,
            modelClass: ModelClass.LARGE,
        });
        console.log("✅ Step 3: LLM response received");

        if (!response) {
            console.error("❌ No response from generateMessageResponse");
            return {
                text: "I apologize, but I'm having trouble generating a response right now.",
                source: "gmail",
            };
        }

        console.log("✅ Step 5: Returning generated response");
        return response;
    }

    private async archiveEmail(emailId: string) {
        console.log("📥 Archiving email: ", emailId);
        try {
            const gmail = google.gmail({
                version: "v1",
                auth: this.googleClient.oAuth2Client,
            });

            await gmail.users.messages.modify({
                userId: "me",
                id: emailId,
                requestBody: {
                    removeLabelIds: ["UNREAD", "INBOX"],
                },
            });
            console.log("✅ Email archived successfully");
        } catch (error) {
            console.error("❌ Error archiving email:", error);
        }
    }

    private async replyAndArchiveEmail(emailId: string, response: string) {
        console.log("📤 Replying to email: ", emailId);
        try {
            const gmail = google.gmail({
                version: "v1",
                auth: this.googleClient.oAuth2Client,
            });

            const message = await gmail.users.messages.get({
                userId: "me",
                id: emailId,
            });

            const headers = message.data.payload?.headers;
            const subject =
                headers?.find((h) => h.name === "Subject")?.value || "";
            const references =
                headers?.find((h) => h.name === "References")?.value || "";
            const inReplyTo =
                headers?.find((h) => h.name === "Message-ID")?.value || "";
            const to = headers?.find((h) => h.name === "From")?.value || "";

            const raw = Buffer.from(
                `From: me\r\n` +
                    `To: ${to}\r\n` +
                    `Subject: Re: ${subject}\r\n` +
                    `References: ${references} ${inReplyTo}\r\n` +
                    `In-Reply-To: ${inReplyTo}\r\n` +
                    `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
                    `${response}`
            )
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");

            await gmail.users.messages.send({
                userId: "me",
                requestBody: {
                    raw,
                    threadId: message.data.threadId,
                },
            });
            console.log("✅ Email reply sent successfully");
        } catch (error) {
            console.error("❌ Error sending email reply:", error);
        }

        // Archive email
        await this.archiveEmail(emailId);
    }
}

export const GmailClientInterface: ElizaClient = {
    start: async (runtime: IAgentRuntime) => new GmailClient(runtime),
    stop: async (runtime: IAgentRuntime) => {
        try {
            // stop it
            elizaLogger.success("Stopping gmail client", runtime.agentId);
            await runtime.clients.gmail.stop();
        } catch (e) {
            elizaLogger.error("client-gmail interface stop error", e);
        }
    },
};
