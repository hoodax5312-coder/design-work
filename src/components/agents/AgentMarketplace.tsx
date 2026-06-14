import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  MessageSquareText,
  Search,
  Send,
  Sparkles,
  X
} from 'lucide-react';
import { agentProfiles, type AgentProfile } from '../../data/agents';
import { cn } from '../../lib/utils';
import { useConversationChat } from '../../hooks/useConversationChat';
import { useUIStore } from '../../stores/useUIStore';

const previewText = (value: string, length = 118) => (
  value.length > length ? `${value.slice(0, length)}...` : value
);

const categoryOrder = ['全部', '工程', '设计', '产品', '测试', '项目管理', '销售', '学术', '空间计算'];

const AgentCard = ({
  agent,
  isSelected,
  onSelect,
  onChat
}: {
  agent: AgentProfile;
  isSelected: boolean;
  onSelect: () => void;
  onChat: () => void;
}) => (
  <article
    className={cn(
      'group flex min-h-[236px] flex-col rounded-xl border bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300',
      isSelected ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-200 hover:border-slate-300'
    )}
  >
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className="grid h-11 w-11 place-items-center rounded-lg text-xl"
          style={{ backgroundColor: `${agent.color}18`, color: agent.color }}
        >
          {agent.emoji}
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-950">{agent.name}</div>
          <div className="mt-1 text-xs font-medium text-slate-400">{agent.category}</div>
        </div>
      </div>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
        Agent
      </span>
    </div>

    <p className="line-clamp-3 text-sm leading-6 text-slate-600">{agent.description}</p>
    <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
      {previewText(agent.vibe, 72)}
    </div>

    <div className="mt-auto flex items-center justify-between pt-5">
      <button
        onClick={onSelect}
        className="text-sm font-medium text-slate-900 transition-colors hover:text-slate-600"
      >
        查看详情
      </button>
      <button
        onClick={onChat}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800"
      >
        进入对话
        <ArrowRight size={14} />
      </button>
    </div>
  </article>
);

const DetailPanel = ({
  agent,
  onClose,
  onChat
}: {
  agent: AgentProfile;
  onClose: () => void;
  onChat: () => void;
}) => (
  <aside className="flex h-full w-[390px] shrink-0 flex-col border-l border-slate-200 bg-white">
    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <div>
        <div className="text-sm font-medium text-slate-400">Agent 详情</div>
        <div className="mt-1 text-lg font-semibold text-slate-950">{agent.name}</div>
      </div>
      <button
        onClick={onClose}
        className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={18} />
      </button>
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <div className="mb-5 flex items-center gap-3">
        <div
          className="grid h-14 w-14 place-items-center rounded-xl text-2xl"
          style={{ backgroundColor: `${agent.color}18`, color: agent.color }}
        >
          {agent.emoji}
        </div>
        <div>
          <div className="text-xs font-medium text-slate-400">{agent.category}</div>
          <div className="mt-1 text-sm leading-5 text-slate-600">{agent.vibe}</div>
        </div>
      </div>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-950">简介</h3>
        <p className="text-sm leading-6 text-slate-600">{agent.description}</p>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-950">核心使命</h3>
        <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{agent.mission}</p>
      </section>

      {agent.rules && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-950">关键规则</h3>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{agent.rules}</p>
        </section>
      )}

      {agent.workflow && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-950">工作流程</h3>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{agent.workflow}</p>
        </section>
      )}
    </div>

    <div className="border-t border-slate-200 p-4">
      <button
        onClick={onChat}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        <MessageSquareText size={17} />
        进入对话
      </button>
    </div>
  </aside>
);

const ChatPanel = ({
  agent,
  onBack
}: {
  agent: AgentProfile;
  onBack: () => void;
}) => {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const openModal = useUIStore((state) => state.openModal);
  const { messages, provider, loading, send } = useConversationChat({
    agentId: agent.id,
    agentName: agent.name,
    systemPrompt: [
      `你是${agent.name}。`,
      agent.vibe,
      agent.description,
      `核心使命：${agent.mission}`,
      agent.rules ? `关键规则：${agent.rules}` : '',
      agent.workflow ? `工作流程：${agent.workflow}` : '',
      '请始终使用用户当前使用的语言回答，并严格遵循上述角色设定。',
    ].filter(Boolean).join('\n\n'),
  });

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content || loading) return;
    setError('');
    try {
      await send(content);
      setDraft('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '发送失败');
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
        >
          <ArrowLeft size={17} />
          返回广场
        </button>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span>{agent.emoji}</span>
          {agent.name}
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-6 py-8">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {!messages.length && (
            <div className="max-w-[78%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
              你好，我是{agent.name}。{agent.vibe}
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',
                message.role === 'user'
                  ? 'ml-auto bg-slate-950 text-white'
                  : message.error
                    ? 'border border-red-200 bg-red-50 text-red-700'
                    : 'border border-slate-200 bg-white text-slate-700',
              )}
            >
              {message.content || (loading ? '正在思考...' : '')}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={`向${agent.name}描述你的问题...`}
            className="min-h-[92px] w-full resize-none bg-transparent px-1 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between">
            <button
              onClick={() => openModal('settings')}
              className="max-w-[65%] truncate text-xs text-slate-400 hover:text-slate-700"
            >
              {provider?.apiKey ? `${provider.name} · ${provider.model}` : '配置 API Provider'}
            </button>
            <button
              onClick={() => void sendMessage()}
              className="flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!draft.trim() || loading}
            >
              发送
              <Send size={15} />
            </button>
          </div>
          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export const AgentMarketplace = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(agentProfiles[0] ?? null);
  const [chatAgent, setChatAgent] = useState<AgentProfile | null>(null);

  const categories = useMemo(() => {
    const known = new Set(agentProfiles.map((agent) => agent.category));
    const ordered = categoryOrder.filter((item) => item === '全部' || known.has(item));
    const extra = [...known].filter((item) => !ordered.includes(item)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    return [...ordered, ...extra];
  }, []);

  const filteredAgents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return agentProfiles.filter((agent) => {
      const matchesCategory = category === '全部' || agent.category === category;
      const matchesQuery = !normalizedQuery || [agent.name, agent.description, agent.vibe, agent.category]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const startChat = (agent: AgentProfile) => {
    setSelectedAgent(agent);
    setChatAgent(agent);
  };

  if (chatAgent) {
    return <ChatPanel agent={chatAgent} onBack={() => setChatAgent(null)} />;
  }

  return (
    <div className="flex h-full bg-white">
      <div className="min-w-0 flex-1 overflow-y-auto px-10 py-9">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                <Bot size={14} />
                Agent 广场
              </div>
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">选择智能体协作</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                已从本地智能体库导入 {agentProfiles.length} 个角色。卡片展示摘要，详情里可以查看使命、规则和工作流程。
              </p>
            </div>

            <div className="relative w-full lg:w-[320px]">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索智能体、能力或分类"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={cn(
                  'h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors',
                  category === item
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgent?.id === agent.id}
                onSelect={() => setSelectedAgent(agent)}
                onChat={() => startChat(agent)}
              />
            ))}
          </div>

          {!filteredAgents.length && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <Sparkles className="mx-auto mb-3 text-slate-300" size={28} />
              <div className="font-medium text-slate-900">没有匹配的智能体</div>
              <p className="mt-2 text-sm text-slate-500">换个关键词或分类试试。</p>
            </div>
          )}
        </div>
      </div>

      {selectedAgent && (
        <DetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onChat={() => startChat(selectedAgent)}
        />
      )}
    </div>
  );
};
