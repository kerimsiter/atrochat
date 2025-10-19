import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './chatStore';
import { Role } from '../types';

// Mock the geminiService
vi.mock('../services/geminiService', () => ({
  getGeminiChatStream: vi.fn(),
  generateSingleResponse: vi.fn(),
  countTokens: vi.fn().mockResolvedValue(10),
}));

describe('chatStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useChatStore.setState({
      sessions: [],
      activeSessionId: null,
    });
  });

  it('should edit a message and resend it', async () => {
    const { editMessage, startNewChat } = useChatStore.getState();
    startNewChat();

    const sessionId = useChatStore.getState().activeSessionId;
    expect(sessionId).not.toBeNull();

    // Add a user message
    useChatStore.setState(state => ({
      sessions: state.sessions.map(s =>
        s.id === sessionId
          ? { ...s, messages: [{ id: 'msg-1', role: Role.USER, content: 'Hello', timestamp: new Date().toISOString() }] }
          : s
      ),
    }));

    // Mock sendMessage
    const sendMessage = vi.fn();
    useChatStore.setState({ sendMessage });

    // Edit the message
    await editMessage('msg-1', 'Hello, world!');

    // Check that sendMessage was called with the new content
    expect(sendMessage).toHaveBeenCalledWith('Hello, world!', [], false, false);

    // Check that the original message is removed and the new one is not yet there (as it's handled by sendMessage)
    const session = useChatStore.getState().sessions.find(s => s.id === sessionId);
    expect(session?.messages.find(m => m.id === 'msg-1')).toBeUndefined();
  });
});
