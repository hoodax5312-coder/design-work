import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  projectId?: string;
  agentId?: string;
  agentName?: string;
  systemPrompt?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  createConversation: (options?: {
    projectId?: string;
    agentId?: string;
    agentName?: string;
    systemPrompt?: string;
  }) => string;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    updates: Partial<ChatMessage>,
  ) => void;
  archiveProjectConversations: (projectId: string) => void;
  removeProjectConversations: (projectId: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      activeConversationId: null,
      createConversation: (options) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const conversation: Conversation = {
          id,
          title: options?.agentName ? `与 ${options.agentName} 对话` : '新对话',
          projectId: options?.projectId,
          agentId: options?.agentId,
          agentName: options?.agentName,
          systemPrompt: options?.systemPrompt,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },
      setActiveConversation: (id) => set({ activeConversationId: id }),
      addMessage: (conversationId, message) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation.id !== conversationId) return conversation;
            const messages = [...conversation.messages, message];
            const firstUserMessage = messages.find((item) => item.role === 'user');
            return {
              ...conversation,
              title:
                conversation.title === '新对话' && firstUserMessage
                  ? firstUserMessage.content.slice(0, 28)
                  : conversation.title,
              messages,
              updatedAt: Date.now(),
            };
          }),
        })),
      updateMessage: (conversationId, messageId, updates) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: conversation.messages.map((message) =>
                    message.id === messageId ? { ...message, ...updates } : message,
                  ),
                  updatedAt: Date.now(),
                }
                : conversation,
          ),
        })),
      archiveProjectConversations: (projectId) =>
        set((state) => ({
          conversations: state.conversations.map((conversation) =>
            conversation.projectId === projectId
              ? { ...conversation, archivedAt: Date.now(), updatedAt: Date.now() }
              : conversation,
          ),
          activeConversationId:
            state.conversations.find(
              (conversation) =>
                conversation.id === state.activeConversationId &&
                conversation.projectId === projectId,
            )
              ? null
              : state.activeConversationId,
        })),
      removeProjectConversations: (projectId) =>
        set((state) => {
          const removedActive = state.conversations.some(
            (conversation) =>
              conversation.id === state.activeConversationId &&
              conversation.projectId === projectId,
          );
          return {
            conversations: state.conversations.filter(
              (conversation) => conversation.projectId !== projectId,
            ),
            activeConversationId: removedActive ? null : state.activeConversationId,
          };
        }),
    }),
    { name: 'mboard-conversations' },
  ),
);
