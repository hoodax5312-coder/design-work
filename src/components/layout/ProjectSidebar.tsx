import { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Clapperboard,
  Database,
  FileText,
  FolderKanban,
  FolderOpen,
  GitBranch,
  Image as ImageIcon,
  Layers3,
  PackageCheck,
  Pencil,
  Pin,
  Presentation,
  Trash2,
} from '@/lib/remixIconShim';
import {
  RiArchiveStackFill,
  RiArchiveStackLine,
  RiFileTextFill,
  RiFileTextLine,
  RiImageAiFill,
  RiImageAiLine,
  RiInfinityFill,
  RiInfinityLine,
  RiSettings3Fill,
  RiSettings3Line,
  RiToolsFill,
  RiToolsLine,
  type RemixiconComponentType,
} from '@remixicon/react';
import { cn } from '../../lib/utils';
import { useProjectStore } from '../../stores/useProjectStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { ModuleType, type WorkspaceMode, useUIStore } from '../../stores/useUIStore';
import { Button, Card, Separator } from '../ui';

const navigationGroups: Array<{
  title: string;
  items: Array<{
    module: ModuleType;
    label: string;
    lineIcon: RemixiconComponentType;
    fillIcon: RemixiconComponentType;
    workspaceMode?: WorkspaceMode;
  }>;
}> = [
  {
    title: '创作',
    items: [
      { module: 'image-gen', label: '生成', lineIcon: RiImageAiLine, fillIcon: RiImageAiFill },
    ],
  },
  {
    title: '管理',
    items: [
      { module: 'assets', label: '资产', lineIcon: RiArchiveStackLine, fillIcon: RiArchiveStackFill },
      { module: 'sources', label: '知识', lineIcon: RiFileTextLine, fillIcon: RiFileTextFill },
      { module: 'magic-canvas', label: '画布', lineIcon: RiInfinityLine, fillIcon: RiInfinityFill },
      { module: 'tools', label: '工具', lineIcon: RiToolsLine, fillIcon: RiToolsFill },
      { module: 'settings', label: '设置', lineIcon: RiSettings3Line, fillIcon: RiSettings3Fill },
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
  'background-remove': { title: '抠图去背景', section: '图片处理', entries: [] },
  'product-retouch': { title: '产品图精修', section: '图片处理', entries: [] },
  settings: { title: '设置', section: '工作台设置', entries: [] },
};
void explorerContent;

export const ProjectSidebar = () => {
  const {
    activeModule,
    workspaceMode,
    projectSidebarOpen,
    sidebarStyle,
    sidebarCollapseMode,
    setActiveModule,
    setWorkspaceMode,
    toggleProjectSidebar,
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
  const sidebarHidden = !projectSidebarOpen && sidebarCollapseMode === 'hidden';
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const initializedProjectRef = useRef<string | null>(null);
  const contextProject = projects.find((project) => project.id === contextMenu?.projectId);
  // 资产资料库是固定导航，不随上方生成/画板模块切换。

  const openModule = (
    module: ModuleType,
    mode: WorkspaceMode = 'editor',
  ) => {
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
        'group relative flex h-full shrink-0 flex-col overflow-visible bg-transparent text-sidebar-foreground transition-[width] duration-200 ease-out',
        projectSidebarOpen ? 'w-[200px]' : sidebarHidden ? 'w-0' : 'w-16',
        sidebarStyle === 'standard' && 'border-r border-sidebar-border bg-sidebar',
        sidebarStyle === 'floating' && 'my-2 ml-2 h-[calc(100%-16px)] rounded-xl border border-sidebar-border bg-sidebar shadow-sm',
      )}
    >
      <div className={cn('relative flex h-16 shrink-0 items-center', projectSidebarOpen ? 'gap-2 px-3' : 'justify-center', sidebarHidden && 'invisible')}>
        <Button type="button" variant="ghost" size="iconSm"
          onClick={() => openModule('assets')}
          aria-label="打开资产库"
          title="栗作 LIZUO"
          className="relative h-9 w-9 shrink-0 overflow-hidden bg-transparent p-0 text-sidebar-foreground shadow-none hover:bg-transparent hover:text-sidebar-foreground"
        >
          <img src="/brand/lizuo-avatar.png" alt="" draggable={false} className="size-8 rounded-[4px] object-cover" />
        </Button>
        {projectSidebarOpen && (
            <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.01em]">栗作 LIZUO</span>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="iconSm"
        onClick={toggleProjectSidebar}
        aria-label={projectSidebarOpen ? '收起侧栏' : '展开侧栏'}
        title={projectSidebarOpen ? '收起侧栏' : '展开侧栏'}
        className={cn(
          'absolute top-1/2 z-20 h-12 w-3 -translate-y-1/2 rounded-md border border-border bg-card p-0 text-muted-foreground opacity-0 shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-opacity hover:bg-card hover:text-foreground hover:opacity-100 group-hover:opacity-100',
          sidebarHidden ? 'right-[-12px]' : 'right-[-6px]',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'block h-0 w-0 border-y-[4px] border-y-transparent',
            projectSidebarOpen ? 'border-r-[5px] border-r-current' : 'border-l-[5px] border-l-current',
          )}
        />
      </Button>

      <nav
        aria-label="主要功能"
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-2',
          projectSidebarOpen ? 'px-2' : 'px-1',
          sidebarHidden && 'invisible pointer-events-none',
        )}
      >
        {navigationGroups.map((group) => (
          <section key={group.title} className={cn('flex flex-col gap-1', !projectSidebarOpen && 'items-center')}>
            {group.items.map((item) => {
              const itemWorkspaceMode = item.workspaceMode || 'editor';
              const active = workspaceMode === itemWorkspaceMode
                && activeModule === item.module;
              const Icon = active ? item.fillIcon : item.lineIcon;
              return (
              <Button type="button" variant="ghost"
                key={item.module}
                onClick={() => openModule(item.module, itemWorkspaceMode)}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  projectSidebarOpen
                    ? 'h-10 w-full justify-start gap-3 px-3 text-sm'
                    : 'h-12 w-14 flex-col justify-center gap-1 px-0 text-[10px] leading-none',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon
                  size={18}
                  className="shrink-0"
                />
                <span className={cn('truncate', !projectSidebarOpen && 'max-w-full')}>{item.label}</span>
              </Button>
              );
            })}
          </section>
        ))}
      </nav>

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
