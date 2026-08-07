import {
  Code,
  Eye,
  Grid,
  HelpCircle,
  Image as ImageIcon,
  LayoutPanelTop,
  Library,
  Link,
  Map as MapIcon,
  Maximize,
  MousePointer2,
  Phone,
  Plus,
  Sparkles,
  Type,
  Upload,
  User,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useUIStore, type PanelType } from '../../stores/useUIStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { cn } from '../../lib/utils';
import { Button, Card, Separator } from '../ui';

const SidebarIcon = ({
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="iconSm"
    onClick={onClick}
    aria-label={label}
    aria-pressed={isActive}
    title={label}
    className={cn(
      'pointer-events-auto h-9 w-9 rounded-md',
      isActive && 'bg-muted text-foreground hover:bg-muted hover:text-foreground',
    )}
  >
    <Icon size={17} strokeWidth={isActive ? 2.4 : 1.9} />
  </Button>
);

export const Sidebar = () => {
  const { activePanel, setActivePanel, openModal } = useUIStore();
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { zoomLevel, toggleMinimap, showMinimap } = useCanvasStore();

  const togglePanel = (panel: PanelType) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  const primaryItems = [
    { icon: Grid, label: '画布', active: false, onClick: () => undefined },
    { icon: Phone, label: '工作流', active: activePanel === 'workflow', onClick: () => togglePanel('workflow') },
    { icon: User, label: '角色', active: false, onClick: () => undefined },
    { icon: LayoutPanelTop, label: '面板', active: activePanel === 'assets', onClick: () => togglePanel('assets') },
    { icon: Library, label: '资产库', active: false, onClick: () => undefined },
    { icon: Upload, label: '上传', active: false, onClick: () => undefined },
  ];
  const creationItems = [
    { icon: MousePointer2, label: '选择' },
    { icon: Code, label: '代码' },
    { icon: Eye, label: '预览' },
    { icon: Type, label: '文本' },
    { icon: ImageIcon, label: '图片' },
    { icon: Link, label: '连接' },
    { icon: Sparkles, label: 'AI 助手' },
  ];

  return (
    <>
      <div className="pointer-events-none absolute left-4 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-3">
        <Card padding="sm" className="pointer-events-auto flex flex-col gap-1 shadow-lg">
          {primaryItems.map((item) => (
            <SidebarIcon key={item.label} icon={item.icon} label={item.label} isActive={item.active} onClick={item.onClick} />
          ))}
          <Separator className="my-1" />
          {creationItems.map((item) => (
            <SidebarIcon key={item.label} icon={item.icon} label={item.label} isActive={false} onClick={() => undefined} />
          ))}
        </Card>

        <Button
          type="button"
          variant="primary"
          size="iconLg"
          onClick={() => openModal('workflow')}
          aria-label="新建工作流"
          className="pointer-events-auto rounded-md shadow-lg"
        >
          <Plus size={20} />
        </Button>
      </div>

      <div className="pointer-events-auto absolute bottom-4 left-4 z-50 flex items-center gap-2">
        <Card padding="none" className="flex h-10 items-center px-1 shadow-lg">
          <Button type="button" variant="ghost" size="iconSm" onClick={() => zoomOut({ duration: 300 })} aria-label="缩小画布"><ZoomOut size={15} /></Button>
          <span className="min-w-12 px-1 text-center font-mono text-xs tabular-nums text-muted-foreground">{Math.round(zoomLevel * 100)}%</span>
          <Button type="button" variant="ghost" size="iconSm" onClick={() => zoomIn({ duration: 300 })} aria-label="放大画布"><ZoomIn size={15} /></Button>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button type="button" variant="ghost" size="iconSm" onClick={toggleMinimap} aria-label="切换小地图" aria-pressed={showMinimap} className={showMinimap ? 'bg-accent text-accent-foreground' : undefined}><MapIcon size={15} /></Button>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button type="button" variant="ghost" size="iconSm" onClick={() => fitView({ duration: 800 })} aria-label="适应屏幕"><Maximize size={15} /></Button>
        </Card>
        <Button type="button" variant="secondary" size="iconSm" aria-label="帮助" className="shadow-lg"><HelpCircle size={15} /></Button>
      </div>
    </>
  );
};
