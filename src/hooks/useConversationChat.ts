import { useMemo, useState } from 'react';
import { sendChat } from '../services/providerService';
import { useChatStore, type ChatMessage } from '../stores/useChatStore';
import { getActiveProvider, useProviderStore } from '../stores/useProviderStore';
import { useProjectStore } from '../stores/useProjectStore';

interface ConversationOptions {
  conversationId?: string | null;
  agentId?: string;
  agentName?: string;
  systemPrompt?: string;
}

export const useConversationChat = (options: ConversationOptions = {}) => {
  const {
    conversations,
    activeConversationId,
    createConversation,
    setActiveConversation,
    addMessage,
    updateMessage,
  } = useChatStore();
  const provider = useProviderStore(getActiveProvider);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [loading, setLoading] = useState(false);

  const conversationId = options.conversationId ?? activeConversationId;
  const conversation = useMemo(
    () => conversations.find((item) =>
      item.id === conversationId && (!options.agentId || item.agentId === options.agentId),
    ),
    [conversationId, conversations, options.agentId],
  );

  const send = async (content: string) => {
    const text = content.trim();
    if (!text || loading) return;
    if (!provider?.apiKey) {
      throw new Error('请先在设置中配置并测试 API Provider');
    }

    let targetId = conversation?.id;
    if (!targetId) {
      targetId = createConversation({
        projectId: activeProjectId || undefined,
        agentId: options.agentId,
        agentName: options.agentName,
        systemPrompt: options.systemPrompt,
      });
      setActiveConversation(targetId);
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };
    const history = conversation?.messages || [];

    addMessage(targetId, userMessage);
    addMessage(targetId, assistantMessage);
    setLoading(true);

    try {
      const result = await sendChat(
        provider,
        [...history, userMessage],
        conversation?.systemPrompt || options.systemPrompt,
      );
      updateMessage(targetId, assistantMessage.id, { content: result.content });
    } catch (error) {
      updateMessage(targetId, assistantMessage.id, {
        content: error instanceof Error ? error.message : '请求失败',
        error: true,
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    conversation,
    messages: conversation?.messages || [],
    provider,
    loading,
    send,
  };
};
