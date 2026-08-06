import { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Clapperboard,
  Command,
  Database,
  FileText,
  FolderKanban,
  FolderOpen,
  GitBranch,
  Image as ImageIcon,
  Layers3,
  LayoutDashboard,
  Moon,
  PackageCheck,
  Pencil,
  Pin,
  Presentation,
  Settings,
  Sun,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProjectStore } from '../../stores/useProjectStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { ModuleType, type WorkspaceMode, useUIStore } from '../../stores/useUIStore';
import { Button, Card, Separator } from '../ui';

const navigationGroups: Array<{ title: string; items: Array<{ module: ModuleType; label: string; icon: React.ElementType; workspaceMode?: WorkspaceMode }> }> = [
  {
    title: '资产',
    items: [
      { module: 'image-gen', label: '创作', icon: LayoutDashboard, workspaceMode: 'manager' },
      { module: 'assets', label: '图片', icon: ImageIcon },
      { module: 'video-gen', label: '视频', icon: Clapperboard },
      { module: 'sources', label: '知识', icon: FileText },
      { module: 'tools', label: '工具', icon: Command },
    ],
  },
];

/* Module-specific explorers remain available for future contextual panels. */
const explorerContent: Record<ModuleType, { title: string; section: string; entries: Array<{ label: string; meta?: string; icon: React.ElementType }> }> = {
  tools: {
    title: 'AI 应用',
    section: '最近使用',
    entries: [
      { label: '智能整理', meta: '6', icon: FolderKanban },
      { label: '素材分析', meta: '3', icon: PackageCheck },
      { label: '共享资产', meta: '24', icon: Boxes },
    ],
  },
  'magic-canvas': {
    title: '画板结构',
    section: '当前画板',
    entries: [
      { label: '页面与画板', meta: '4', icon: Layers3 },
      { label: '引用资产', meta: '12', icon: ImageIcon },
      { label: '生成节点', meta: '8', icon: GitBranch },
    ],
  },
  'image-gen': {
    title: '图像资源',
    section: '当前任务',
    entries: [
      { label: '生成批次', meta: '5', icon: ImageIcon },
      { label: '参考图', meta: '8', icon: Boxes },
      { label: '提示词版本', meta: '3', icon: FileText },
    ],
  },
  'ppt-gen': {
    title: '演示结构',
    section: '品牌发布提案',
    entries: [
      { label: '页面大纲', meta: '8', icon: Presentation },
      { label: '母版与规范', meta: '1', icon: Layers3 },
      { label: '演示素材', meta: '16', icon: ImageIcon },
    ],
  },
  'video-gen': {
    title: '视频结构',
    section: '品牌发布片',
    entries: [
      { label: '情节与序列', meta: '3', icon: Clapperboard },
      { label: '镜头片段', meta: '18', icon: Clapperboard },
      { label: '旁白与字幕', meta: '2', icon: FileText },
    ],
  },
  assets: { title: '资产', section: '资料库', entries: [] },
  sources: {
    title: '资源来源',
    section: '存储与连接',
    entries: [
      { label: '本地资产库', meta: '在线', icon: Database },
      { label: 'Higgsfield', meta: '远程', icon: Database },
      { label: '缺失资产', meta: '3', icon: FolderOpen },
    ],
  },
  exports: {
    title: '导出任务',
    section: '交付队列',
    entries: [
      { label: '准备导出', meta: '1', icon: PackageCheck },
      { label: '存在阻塞', meta: '1', icon: Clapperboard },
      { label: '最近导出', meta: '2', icon: FolderOpen },
    ],
  },
  projects: {
    title: '个人空间',
    section: '文件库',
    entries: [
      { label: '公开工程', meta: '同步', icon: FolderKanban },
      { label: '归档清单', meta: '最新', icon: FileText },
      { label: '容量审计', meta: '可用', icon: Database },
    ],
  },
  ecommerce: {
    title: '电商设计',
    section: '当前商品',
    entries: [
      { label: '商品主图', meta: '6', icon: ImageIcon },
      { label: '详情页面', meta: '3', icon: Layers3 },
      { label: '发布版本', meta: '2', icon: PackageCheck },
    ],
  },
};
void explorerContent;

export const ProjectSidebar = () => {
  const {
    activeModule,
    workspaceMode,
    theme,
    setActiveModule,
    setWorkspaceMode,
    toggleTheme,
    openModal,
  } = useUIStore();
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
  const initializedProjectRef = useRef<string | null>(null);
  const contextProject = projects.find((project) => project.id === contextMenu?.projectId);
  // 资产资料库是固定导航，不随上方生成/画板模块切换。

  const openModule = (module: ModuleType, mode: WorkspaceMode = 'editor') => {
    setWorkspaceMode(mode);
    setActiveModule(module);
  };

  useEffect(() => {
    if (!projects.length) {
      const projectId = createProject('未命名项目');
      initializedProjectRef.current = projectId;
      useCanvasStore.getState().restoreSnapshot([], []);
      return;
    }

    const activeProject = projects.find((project) => project.id === activeProjectId) || projects[0];
    if (!activeProjectId) setActiveProject(activeProject.id);
    if (initializedProjectRef.current === null) {
      initializedProjectRef.current = activeProject.id;
      useCanvasStore
        .getState()
        .restoreSnapshot(activeProject.canvas?.nodes || [], activeProject.canvas?.edges || []);
    }
  }, [activeProjectId, createProject, projects, setActiveProject]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (event: MouseEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setContextMenu(null);
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
        'flex h-full w-16 shrink-0 flex-col overflow-hidden border-r border-black/[0.05] bg-card text-foreground dark:border-white/[0.06]',
      )}
    >
      <div className="flex h-[64px] shrink-0 items-center justify-center">
        <Button type="button" variant="secondary" size="iconSm"
          onClick={() => openModule('assets')}
          aria-label="打开资产库"
          title="Mboard"
          className="relative h-9 w-9 shadow-sm"
        >
          <Command size={17} strokeWidth={2.3} />
        </Button>
      </div>

      <nav
        aria-label="主要功能"
        className="flex shrink-0 flex-col items-stretch gap-1 px-2 py-2"
      >
        {navigationGroups.map((group) => (
          <div key={group.title} className="contents">
            {group.items.map((item) => {
              const Icon = item.icon;
              const itemWorkspaceMode = item.workspaceMode || 'editor';
              const active = workspaceMode === itemWorkspaceMode && activeModule === item.module;
              return (
              <Button type="button" variant="ghost"
                key={item.module}
                onClick={() => openModule(item.module, itemWorkspaceMode)}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  'h-12 w-full flex-col gap-1 text-center text-[10px]',
                  active
                    ? 'bg-muted text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon
                  size={17}
                  strokeWidth={active ? 2.2 : 1.8}
                  className="shrink-0"
                />
                <span className="truncate leading-3">{item.label}</span>
              </Button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex shrink-0 flex-col items-stretch gap-1 px-2 py-2">
        {[
          {
            label: theme === 'dark' ? '切换为明亮模式' : '切换为暗黑模式',
            icon: theme === 'dark' ? Sun : Moon,
            action: toggleTheme,
          },
          { label: '设置', icon: Settings, action: () => openModal('settings') },
        ].map(({ label, icon: Icon, action }) => (
          <Button type="button" variant="ghost"
            key={label}
            onClick={action}
            aria-label={label}
            title={label}
            className={cn(
              'h-10 w-full p-0 text-muted-foreground',
            )}
          >
            <Icon size={18} className="shrink-0" />
          </Button>
        ))}
      </div>

      {contextMenu && contextProject && (
        <Card
          ref={contextMenuRef}
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          padding="sm" className="fixed z-[100] w-52 p-1.5 shadow-lg"
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
                runWorkspaceAction('/api/workspace/reveal', { projectId: contextProject.id }),
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
          ].map(({ label, icon: Icon, action }) => (
            <Button type="button" variant="ghost" size="sm"
              key={label}
              role="menuitem"
              onClick={() => {
                action();
                setContextMenu(null);
              }}
              className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs"
            >
              <Icon size={15} className="text-muted-foreground" />
              {label}
            </Button>
          ))}
          <Separator className="my-1" />
          <Button type="button" variant="ghost" size="sm"
            role="menuitem"
            onClick={() => {
              if (window.confirm(`确定移除项目“${contextProject.name}”吗？`)) {
                if (contextProject.id === activeProjectId) initializedProjectRef.current = null;
                removeProject(contextProject.id);
              }
              setContextMenu(null);
            }}
            className="h-9 w-full justify-start gap-2.5 px-2.5 text-left text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={15} />
            移除项目
          </Button>
        </Card>
      )}

      {notice && (
        <div className="fixed bottom-8 left-[84px] z-[110] max-w-sm rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
          {notice}
        </div>
      )}
    </aside>
  );
};
