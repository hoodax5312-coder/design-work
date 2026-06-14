import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Bot,
  ChevronDown,
  Folder,
  FolderOpen,
  GalleryHorizontalEnd,
  GitBranch,
  Hammer,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Settings,
  Trash2,
  UserCircle
} from 'lucide-react';
import { useUIStore, ModuleType } from '../../stores/useUIStore';
import { cn } from '../../lib/utils';
import { useChatStore } from '../../stores/useChatStore';
import { useProjectStore } from '../../stores/useProjectStore';

interface FunctionEntry {
  icon: React.ElementType;
  label: string;
  module: ModuleType;
}

interface HistoryEntry {
  title: string;
  time: string;
  active?: boolean;
  module?: ModuleType;
}

const functionEntries: FunctionEntry[] = [
  { icon: MessageSquarePlus, label: '新建对话', module: 'new-chat' },
  { icon: Bot, label: 'Agent 广场', module: 'agents' },
  { icon: Hammer, label: '使用工具', module: 'tools' },
  { icon: GalleryHorizontalEnd, label: '素材库', module: 'assets' }
];

const formatRelativeTime = (timestamp: number) => {
  const elapsed = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < hour) return `${Math.max(1, Math.floor(elapsed / minute))}分`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}时`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}天`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

const SidebarSection = ({ title }: { title: string }) => (
  <div className="px-3 pb-1 pt-5 text-[13px] font-semibold leading-none text-slate-400">
    {title}
  </div>
);

const FunctionButton = ({
  icon: Icon,
  label,
  isActive,
  onClick
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium transition-colors',
      isActive
        ? 'bg-slate-200/75 text-slate-950 dark:bg-zinc-800 dark:text-white'
        : 'text-slate-700 hover:bg-slate-200/55 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
    )}
  >
    <Icon size={19} strokeWidth={2} className="shrink-0" />
    <span className="truncate">{label}</span>
  </button>
);

const HistoryRow = ({
  title,
  time,
  active,
  inset = false,
  onClick
}: HistoryEntry & { inset?: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      'grid h-9 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 text-left text-[14px] transition-colors',
      active
        ? 'bg-slate-200/80 font-semibold text-slate-950 dark:bg-zinc-800 dark:text-white'
        : 'text-slate-700 hover:bg-slate-200/50 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white',
      inset && 'pl-10'
    )}
  >
    <span className="truncate">{title}</span>
    <span className="text-[13px] tabular-nums text-slate-400">{time}</span>
  </button>
);

const FolderRow = ({
  id,
  label,
  expanded = false,
  onClick,
  onCreateConversation,
  onContextMenu,
  onOpenMenu,
}: {
  id: string;
  label: string;
  expanded?: boolean;
  onClick?: () => void;
  onCreateConversation?: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
  onOpenMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => (
  <div
    data-project-id={id}
    onContextMenu={onContextMenu}
    className="group flex h-9 items-center rounded-lg pr-1 transition-colors hover:bg-slate-200/50 dark:hover:bg-zinc-800"
  >
    <button
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(event);
      }}
      className="flex min-w-0 flex-1 items-center gap-3 px-3 text-left text-[15px] font-medium text-slate-700 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white"
    >
      <Folder size={18} strokeWidth={2} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {expanded && <ChevronDown size={15} className="text-slate-400" />}
    </button>
    {onCreateConversation && (
      <button
        onClick={(event) => {
          event.stopPropagation();
          onCreateConversation();
        }}
        aria-label={`在 ${label} 中新建对话`}
        title="新建对话"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-slate-800 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-white"
      >
        <Pencil size={14} />
      </button>
    )}
    {onOpenMenu && (
      <button
        onClick={(event) => {
          event.stopPropagation();
          onOpenMenu(event);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenMenu(event);
        }}
        aria-label={`${label} 更多操作`}
        title="更多操作"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-slate-800 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-white"
      >
        <MoreHorizontal size={15} />
      </button>
    )}
  </div>
);

export const ProjectSidebar = () => {
  const { projectSidebarOpen, activeModule, setActiveModule, openModal } = useUIStore();
  const {
    conversations,
    activeConversationId,
    createConversation,
    setActiveConversation,
    archiveProjectConversations,
    removeProjectConversations,
  } = useChatStore();
  const {
    projects,
    activeProjectId,
    createProject,
    setActiveProject,
    renameProject,
    toggleProjectPinned,
    removeProject,
  } = useProjectStore();
  const [contextMenu, setContextMenu] = useState<{
    projectId: string;
    x: number;
    y: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const visibleProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt),
    [projects],
  );
  const conversationsByProject = useMemo(() => {
    return conversations
      .filter((conversation) => !conversation.archivedAt && conversation.projectId)
      .reduce<Record<string, typeof conversations>>((groups, conversation) => {
        const projectId = conversation.projectId as string;
        groups[projectId] = groups[projectId] || [];
        groups[projectId].push(conversation);
        return groups;
      }, {});
  }, [conversations]);
  const personalConversations = useMemo(
    () => conversations.filter((conversation) => !conversation.archivedAt && !conversation.projectId),
    [conversations],
  );
  const contextProject = projects.find((project) => project.id === contextMenu?.projectId);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (event: MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const startProject = () => {
    createProject();
    setActiveConversation(null);
    setActiveModule('new-chat');
  };

  const openConversation = (id: string) => {
    const conversation = conversations.find((item) => item.id === id);
    setActiveProject(conversation?.projectId || null);
    setActiveConversation(id);
    setActiveModule('new-chat');
  };

  const openProject = (id: string) => {
    setActiveProject(id);
    setActiveConversation(null);
    setActiveModule('new-chat');
  };

  const startConversationInProject = (projectId: string) => {
    setActiveProject(projectId);
    const conversationId = createConversation({ projectId });
    setActiveConversation(conversationId);
    setActiveModule('new-chat');
  };

  const openProjectMenu = (
    projectId: string,
    x: number,
    y: number,
  ) => {
    setContextMenu({
      projectId,
      x: Math.min(x, window.innerWidth - 220),
      y: Math.min(y, window.innerHeight - 260),
    });
  };

  const runWorkspaceAction = async (
    path: '/api/workspace/reveal' | '/api/workspace/worktree',
    body: Record<string, string>,
  ) => {
    setContextMenu(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '本地工作区操作失败');
      setNotice(
        path.endsWith('reveal')
          ? '已在 Finder 中显示项目目录'
          : `永久工作树已创建：${payload.path}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '本地工作区操作失败');
    }
  };

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-[#f6f7f7] text-slate-900 transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
        projectSidebarOpen ? 'w-[300px]' : 'w-0 border-r-0'
      )}
    >
      <div className="px-4 pb-3 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-slate-950 text-[11px] font-bold text-white dark:bg-white dark:text-slate-950">
            M
          </div>
          <div className="text-[17px] font-semibold tracking-normal">Mboard</div>
        </div>

        <div className="space-y-1">
          {functionEntries.map((item) => (
            <FunctionButton
              key={item.label}
              icon={item.icon}
              label={item.label}
              isActive={activeModule === item.module}
              onClick={() => {
                if (item.module === 'new-chat') {
                  setActiveProject(null);
                  setActiveConversation(null);
                }
                setActiveModule(item.module);
              }}
            />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex items-center justify-between px-1 pb-1 pt-5">
          <button
            onClick={() => {
              setActiveProject(null);
              setActiveModule('projects');
            }}
            className={cn(
              'rounded-md px-2 py-1 text-[13px] font-semibold leading-none transition-colors',
              activeModule === 'projects'
                ? 'bg-slate-200/75 text-slate-800 dark:bg-zinc-800 dark:text-white'
                : 'text-slate-400 hover:bg-slate-200/55 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200',
            )}
          >
            项目
          </button>
          <button
            onClick={startProject}
            aria-label="新建项目"
            title="新建项目"
            className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="space-y-0.5">
          {visibleProjects.map((project) => {
            const expanded = project.id === activeProjectId;
            const projectConversations = conversationsByProject[project.id] || [];

            return (
              <Fragment key={project.id}>
                <FolderRow
                  id={project.id}
                  label={project.name}
                  expanded={expanded}
                  onClick={() => openProject(project.id)}
                  onCreateConversation={() => startConversationInProject(project.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openProjectMenu(project.id, event.clientX, event.clientY);
                  }}
                  onOpenMenu={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    openProjectMenu(project.id, rect.right + 6, rect.bottom);
                  }}
                />
                {expanded && projectConversations.length > 0 && (
                  <div className="mb-1 space-y-0.5">
                    {projectConversations.map((conversation) => (
                      <HistoryRow
                        key={conversation.id}
                        title={conversation.title}
                        time={formatRelativeTime(conversation.updatedAt)}
                        active={activeModule === 'new-chat' && activeConversationId === conversation.id}
                        inset
                        onClick={() => openConversation(conversation.id)}
                      />
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
          {!visibleProjects.length && (
            <button
              onClick={startProject}
              className="w-full rounded-lg px-3 py-3 text-left text-xs text-slate-400 hover:bg-slate-200/50 hover:text-slate-700 dark:hover:bg-zinc-800"
            >
              暂无项目，点击创建
            </button>
          )}
        </div>

        <SidebarSection title="对话" />
        <div className="space-y-0.5">
          {personalConversations
            .map((conversation) => (
            <HistoryRow
              key={conversation.id}
              title={conversation.title}
              time={formatRelativeTime(conversation.updatedAt)}
              active={activeModule === 'new-chat' && activeConversationId === conversation.id}
              onClick={() => openConversation(conversation.id)}
            />
            ))}
          {!personalConversations.length && (
            <div className="px-3 py-3 text-xs text-slate-400">发送第一条消息后，对话会保存在这里。</div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200/80 p-3">
        <button className="mb-1 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-200/55 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">
          <UserCircle size={19} strokeWidth={2} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">个人账户</span>
        </button>
        <button
          onClick={() => openModal('settings')}
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-200/55 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Settings size={19} strokeWidth={2} className="shrink-0" />
          <span className="truncate">设置</span>
        </button>
      </div>

      {contextMenu && contextProject && (
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label={`${contextProject.name} 项目操作`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-[100] w-52 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          {[
            {
              label: contextProject.pinned ? '取消置顶' : '置顶项目',
              icon: Pin,
              action: () => toggleProjectPinned(contextProject.id),
            },
            {
              label: '在 Finder 中显示',
              icon: FolderOpen,
              action: () =>
                runWorkspaceAction('/api/workspace/reveal', {
                  projectId: contextProject.id,
                }),
            },
            {
              label: '创建永久工作树',
              icon: GitBranch,
              action: () =>
                runWorkspaceAction('/api/workspace/worktree', {
                  projectId: contextProject.id,
                  projectName: contextProject.name,
                }),
            },
            {
              label: '重命名项目',
              icon: Pencil,
              action: () => {
                const name = window.prompt('输入新的项目名称', contextProject.name);
                if (name?.trim()) renameProject(contextProject.id, name);
              },
            },
            {
              label: '归档对话',
              icon: Archive,
              action: () => archiveProjectConversations(contextProject.id),
            },
          ].map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              role="menuitem"
              onClick={() => {
                action();
                setContextMenu(null);
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Icon size={16} className="text-slate-500 dark:text-zinc-400" />
              {label}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />
          <button
            role="menuitem"
            onClick={() => {
              if (window.confirm(`确定移除项目“${contextProject.name}”吗？相关对话也会被删除。`)) {
                removeProjectConversations(contextProject.id);
                removeProject(contextProject.id);
                if (contextProject.id === activeProjectId) {
                  setActiveConversation(null);
                  setActiveModule('new-chat');
                }
              }
              setContextMenu(null);
            }}
            className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 size={16} />
            移除
          </button>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-5 left-[316px] z-[110] max-w-sm rounded-lg bg-slate-950 px-3 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-slate-950">
          {notice}
        </div>
      )}
    </aside>
  );
};
