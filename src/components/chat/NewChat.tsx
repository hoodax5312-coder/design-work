import { useState } from 'react';
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Folder,
  GitBranch,
  Mic,
  Plus,
  ShieldCheck,
  Sparkles,
  TerminalSquare
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useConversationChat } from '../../hooks/useConversationChat';
import { useUIStore } from '../../stores/useUIStore';
import { useProjectStore } from '../../stores/useProjectStore';

export const NewChat = () => {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const { messages, provider, loading, send } = useConversationChat();
  const openModal = useUIStore((state) => state.openModal);
  const { projects, activeProjectId } = useProjectStore();
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const contextItems = [
    { icon: Folder, label: activeProject?.name || '个人空间' },
    { icon: TerminalSquare, label: '本地模式' },
    { icon: GitBranch, label: 'main' },
  ];

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
    <div className="flex h-full flex-col bg-white">
      {messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-3xl -translate-y-10">
            <h1 className="mb-9 text-center text-[28px] font-semibold tracking-normal text-slate-900">
              {activeProject
                ? `我们应该在 ${activeProject.name} 中构建什么？`
                : '今天想做什么？'}
            </h1>

            <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="随心输入"
                className="h-24 w-full resize-none bg-transparent px-4 py-4 text-base leading-6 text-slate-800 outline-none placeholder:text-slate-400"
              />

              <div className="flex items-center justify-between px-4 pb-3">
                <div className="flex items-center gap-4">
                  <button
                    aria-label="添加附件"
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Plus size={20} />
                  </button>
                  <button className="flex items-center gap-1.5 text-sm font-medium text-orange-600 transition-colors hover:text-orange-700">
                    <ShieldCheck size={16} />
                    完全访问
                    <ChevronDown size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <button className="flex items-center gap-1 transition-colors hover:text-slate-900">
                    5.5 中
                    <ChevronDown size={14} />
                  </button>
                  <button
                    aria-label="语音输入"
                    className="grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Mic size={17} />
                  </button>
                  <button
                    aria-label="发送消息"
                    onClick={() => void sendMessage()}
                    disabled={!draft.trim() || loading}
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-full text-white transition-colors',
                      draft.trim() && !loading ? 'bg-slate-900 hover:bg-slate-700' : 'bg-slate-300'
                    )}
                  >
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mx-auto flex max-w-[680px] items-center gap-2 rounded-b-[22px] bg-slate-100/80 px-4 py-3 text-sm text-slate-500">
              {contextItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-white hover:text-slate-900"
                  >
                    <Icon size={15} />
                    {item.label}
                    <ChevronDown size={13} />
                  </button>
                );
              })}
              <button
                onClick={() => openModal('settings')}
                className="ml-auto truncate rounded-lg px-2 py-1 hover:bg-white hover:text-slate-900"
              >
                {provider?.apiKey ? `${provider.name} · ${provider.model}` : '配置 API Provider'}
              </button>
            </div>
            {error && <div className="mt-3 text-center text-sm text-red-600">{error}</div>}
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-6 py-8">
          <div className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Sparkles size={16} />
            新对话
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6',
                  message.role === 'user'
                    ? 'ml-auto bg-slate-950 text-white'
                    : message.error
                      ? 'border border-red-200 bg-red-50 text-red-700'
                      : 'border border-slate-200 bg-white text-slate-700 shadow-sm',
                )}
              >
                {message.role === 'assistant' && (
                  <div className="mb-1 flex items-center gap-2 font-medium text-slate-900">
                    <Bot size={16} />
                    Mboard
                  </div>
                )}
                {message.content || (loading ? '正在思考...' : '')}
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="继续对话..."
              className="h-20 w-full resize-none bg-transparent px-4 py-3 text-sm outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <button onClick={() => openModal('settings')} className="max-w-[70%] truncate text-xs text-slate-500 hover:text-slate-900">
                {provider?.name} · {provider?.model}
              </button>
              <button
                onClick={() => void sendMessage()}
                disabled={!draft.trim() || loading}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-white disabled:bg-slate-300"
              >
                <ArrowUp size={17} />
              </button>
            </div>
          </div>
          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
};
