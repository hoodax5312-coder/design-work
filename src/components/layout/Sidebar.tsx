import { Plus, Library, User, Grid, Phone, LayoutPanelTop, Upload, HelpCircle, ZoomIn, ZoomOut, Maximize, MousePointer2, Code, Eye, Type, Image as ImageIcon, Link, Sparkles, Map as MapIcon } from 'lucide-react';
import { useUIStore, PanelType } from '../../stores/useUIStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useReactFlow } from '@xyflow/react';
import { cn } from '../../lib/utils';

const SidebarIcon = ({
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
      "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 group relative pointer-events-auto",
      isActive 
        ? "bg-accent-cyan text-white shadow-lg shadow-accent-cyan/20" 
        : "text-zinc-400 hover:text-white hover:bg-white/10"
    )}
    title={label}
  >
    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
  </button>
);

export const Sidebar = () => {
  const { activePanel, setActivePanel, openModal } = useUIStore();
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { zoomLevel, toggleMinimap, showMinimap } = useCanvasStore();

  const togglePanel = (panel: PanelType) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50 pointer-events-none">
        <div className="bg-zinc-900 border border-white/10 rounded-full p-1.5 flex flex-col gap-2 shadow-2xl pointer-events-auto">
          <SidebarIcon 
            icon={Grid} 
            label="画布" 
            isActive={false}
            onClick={() => {}} 
          />
          <SidebarIcon 
            icon={Phone} 
            label="工作流" 
            isActive={activePanel === 'workflow'} 
            onClick={() => togglePanel('workflow')} 
          />
          <SidebarIcon 
            icon={User} 
            label="角色" 
            isActive={false}
            onClick={() => {}} 
          />
          <SidebarIcon 
            icon={LayoutPanelTop} 
            label="面板" 
            isActive={activePanel === 'assets'} 
            onClick={() => togglePanel('assets')} 
          />
          <SidebarIcon 
            icon={Library} 
            label="资产库" 
            isActive={false}
            onClick={() => {}} 
          />
          <SidebarIcon 
            icon={Upload} 
            label="上传" 
            isActive={false}
            onClick={() => {}} 
          />

          <div className="h-px w-8 bg-white/10 my-1 self-center" />

          <SidebarIcon 
            icon={MousePointer2} 
            label="选择" 
            isActive={false}
            onClick={() => {}} 
          />
          <SidebarIcon 
            icon={Code} 
            label="代码" 
            isActive={false}
            onClick={() => {}} 
          />
          <SidebarIcon 
            icon={Eye} 
            label="预览" 
            isActive={false}
            onClick={() => {}} 
          />
          <SidebarIcon 
            icon={Type} 
            label="文本" 
            isActive={false}
            onClick={() => {}} 
          />
          <SidebarIcon 
            icon={ImageIcon} 
            label="图片" 
            isActive={false}
            onClick={() => {}} 
          />
          <SidebarIcon 
            icon={Link} 
            label="连接" 
            isActive={false}
            onClick={() => {}} 
          />
          <button className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 group relative pointer-events-auto bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30" title="AI 助手">
            <Sparkles size={20} />
          </button>
        </div>

        <button 
          onClick={() => openModal('workflow')}
          className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors shadow-xl pointer-events-auto"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Bottom Left Controls */}
      <div className="absolute left-4 bottom-4 z-50 pointer-events-auto flex items-center gap-2">
        <div className="flex items-center bg-zinc-900 border border-white/10 rounded-full p-1 shadow-xl">
          <button onClick={() => zoomOut({ duration: 300 })} className="p-2 text-zinc-400 hover:text-white transition-colors">
            <ZoomOut size={16} />
          </button>
          
          <div className="flex items-center gap-2 px-2 min-w-[60px] justify-center">
            <span className="text-xs font-mono text-zinc-300">{Math.round(zoomLevel * 100)}%</span>
          </div>

          <button onClick={() => zoomIn({ duration: 300 })} className="p-2 text-zinc-400 hover:text-white transition-colors">
            <ZoomIn size={16} />
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          <button 
            onClick={toggleMinimap}
            className={cn(
              "p-2 transition-colors",
              showMinimap ? "text-accent-cyan" : "text-zinc-400 hover:text-white"
            )}
            title="小地图"
          >
            <MapIcon size={16} />
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          <button 
            onClick={() => fitView({ duration: 800 })}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            title="适应屏幕"
          >
            <Maximize size={16} />
          </button>
        </div>

        <button className="w-9 h-9 bg-zinc-900 border border-white/10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-colors shadow-xl" title="帮助">
          <HelpCircle size={16} />
        </button>
      </div>
    </>
  );
};
