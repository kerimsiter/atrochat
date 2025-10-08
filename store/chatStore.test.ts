import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChatStore, ChatStore } from './chatStore';
import { Role, Message } from '../types';

// Mock dependencies
vi.mock('../services/geminiService', () => ({
  getGeminiChatStream: vi.fn(),
  generateSingleResponse: vi.fn(),
  countTokens: vi.fn().mockResolvedValue(10),
}));

const initialStoreState = useChatStore.getState();

describe('ChatStore - editMessage', () => {
  let initialSession;

  beforeEach(() => {
    // Reset the store to its initial state before each test
    useChatStore.setState(initialStoreState, true);

    // Get the store's actions
    const { startNewChat } = useChatStore.getState();

    // 1. Create a new chat session
    startNewChat();

    // 2. Get the newly created session and its ID from the updated state
    const currentState = useChatStore.getState();
    initialSession = currentState.sessions[0];

    // 3. Manually set up the messages for the test scenario
    const testMessages: Message[] = [
      { id: 'msg1', role: Role.USER, content: 'Hello', timestamp: new Date().toISOString() },
      { id: 'msg2', role: Role.MODEL, content: 'Hi there!', timestamp: new Date().toISOString() },
      { id: 'msg3', role: Role.USER, content: 'How are you?', timestamp: new Date().toISOString() },
      { id: 'msg4', role: Role.MODEL, content: 'I am good, thanks!', timestamp: new Date().toISOString() },
    ];
    initialSession.messages = testMessages;

    // 4. Update the store with the session containing test messages
    useChatStore.setState({
      sessions: [initialSession, ...currentState.sessions.slice(1)],
      activeSessionId: initialSession.id,
    });

    // 5. Mock setTimeout to be immediate for the test
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should truncate history and resend the edited message', async () => {
    const { getState } = useChatStore;

    // Spy on sendMessage to verify it's called
    const sendMessageSpy = vi.spyOn(getState(), 'sendMessage').mockImplementation(async () => {});

    const messageToEditId = 'msg3';
    const newContent = 'Tell me a joke.';

    // --- Action ---
    getState().editMessage(messageToEditId, newContent);

    // Advance timers to execute the setTimeout in editMessage
    vi.runAllTimers();

    // --- Assertions ---
    const updatedSession = getState().sessions[0];

    // 1. Check that the message list was truncated correctly before resend
    // The state update happens sync, so we check that first.
    expect(updatedSession.messages.length).toBe(2);
    expect(updatedSession.messages[0].id).toBe('msg1');
    expect(updatedSession.messages[1].id).toBe('msg2');

    // 2. Check that sendMessage was called with the correct parameters
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith(newContent, [], false, false);

    // 3. (Optional) Verify the final state after the mocked sendMessage resolves
    // In a real scenario, sendMessage would add new user and model messages.
    // We can simulate this part to be thorough.
    const finalUserMessage: Message = { id: 'msg5', role: Role.USER, content: newContent, timestamp: '' };
    const finalModelMessage: Message = { id: 'msg6', role: Role.MODEL, content: 'Why did the scarecrow win an award? Because he was outstanding in his field!', timestamp: '' };

    // Manually update the state as if sendMessage ran
    useChatStore.setState(state => ({
        sessions: state.sessions.map(s => s.id === initialSession.id ? { ...s, messages: [...s.messages, finalUserMessage, finalModelMessage] } : s)
    }));

    const finalSession = getState().sessions[0];
    expect(finalSession.messages.length).toBe(4);
    expect(finalSession.messages[2].content).toBe(newContent);
    expect(finalSession.messages[3].role).toBe(Role.MODEL);
  });
});