import { describe, it, expect, vi } from 'vitest';
import { PostContentCreator } from '../src/services/PostContentCreator';
import { IAgentRuntime, ModelClass } from '@elizaos/core';

vi.mock('@elizaos/core', async () => {
    const actual = await vi.importActual('@elizaos/core');
    return {
        ...actual as object,
        generateText: vi.fn(),
    };
});

describe('PostContentCreator', () => {
    const mockRuntime = {
        agentId: 'test-agent',
        character: {
            topics: ['AI', 'Machine Learning', 'Web Development'],
        },
        composeState: vi.fn(),
        messageManager: {
            createMemory: vi.fn(),
        },
    } as unknown as IAgentRuntime;

    const creator = new PostContentCreator(mockRuntime);

    it('should create post content successfully', async () => {
        const userId = 'test-user';
        const mockGeneratedText = 'This is a generated post about #AI and #MachineLearning';
        const mockState = { state: 'data' };
        // @ts-ignore
        vi.mocked(mockRuntime.composeState).mockResolvedValueOnce(mockState);

        const { generateText } = await import('@elizaos/core');
        vi.mocked(generateText).mockResolvedValueOnce(mockGeneratedText);

        const result = await creator.createPostContent(userId);

        expect(mockRuntime.composeState).toHaveBeenCalledWith({
            userId: mockRuntime.agentId,
            roomId: expect.any(String),
            agentId: mockRuntime.agentId,
            content: {
                text: 'AI, Machine Learning, Web Development',
                action: 'LINKEDIN_POST',
            },
        });

        expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
            runtime: mockRuntime,
            modelClass: ModelClass.SMALL
        }));

        expect(result).toBe('This is a generated post about #AI and #MachineLearning');
    });

    it('should escape special characters in content', () => {
        const testContent = 'Test (content) with [brackets] and {braces}';
        const escaped = creator.escapeSpecialCharacters(testContent);

        expect(escaped).toBe('Test \\(content\\) with \\[brackets\\] and \\{braces\\}');
    });

    it('should remove markdown formatting', () => {
        const markdownContent = '**Bold** and *italic* with `code`';
        const plainText = creator.removeMd(markdownContent);

        expect(plainText).toBe('Bold and italic with code');
    });

    it('should handle empty topics array', async () => {
        const emptyTopicsRuntime = {
            ...mockRuntime,
            character: {
                topics: [],
            },
        } as unknown as IAgentRuntime;

        const creatorWithEmptyTopics = new PostContentCreator(emptyTopicsRuntime);
        const userId = 'test-user';
        // @ts-ignore
        vi.mocked(emptyTopicsRuntime.composeState).mockResolvedValueOnce({});

        const { generateText } = await import('@elizaos/core');
        vi.mocked(generateText).mockResolvedValueOnce('Generated content');

        await creatorWithEmptyTopics.createPostContent(userId);

        expect(emptyTopicsRuntime.composeState).toHaveBeenCalledWith({
            userId: mockRuntime.agentId,
            roomId: expect.any(String),
            agentId: mockRuntime.agentId,
            content: {
                text: '',
                action: 'LINKEDIN_POST',
            },
        });
    });
});
