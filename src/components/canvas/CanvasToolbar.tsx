import React, { useState } from 'react';
import { 
  Type, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  Clock, 
  User, 
  LayoutGrid, 
  MessageSquare,
  Upload,
  Wand2,
  Film,
  PlaySquare,
  Scissors,
  Clapperboard,
  Network,
  Boxes
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { nanoid } from 'nanoid';

interface ToolbarItemProps {
  icon: React.ElementType;
  label?: string;
  active?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

const ToolbarItem = ({ icon: Icon, label, active, onClick, children }: ToolbarItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onClick}
        className={cn(
          "p-3 rounded-xl transition-all flex items-center justify-center relative group z-20",
          active
            ? "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/20"
            : "text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-700/50 bg-white dark:bg-zinc-800 shadow-sm border border-slate-100 dark:border-zinc-700"
        )}
      >
        <Icon size={20} strokeWidth={2} />
        
        {/* Tooltip Label (Only if no children/submenu) */}
        {!children && isHovered && label && (
          <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg shadow-xl whitespace-nowrap z-50 animate-in fade-in slide-in-from-left-2">
            {label}
          </div>
        )}
      </button>

      {/* Hover Menu / Submenu */}
      {children && (
        <div 
          className={cn(
            "absolute left-full ml-3 pl-2 transition-all duration-200 origin-left z-10",
            isHovered 
              ? "opacity-100 translate-x-0 pointer-events-auto" 
              : "opacity-0 -translate-x-2 pointer-events-none"
          )}
        >
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-slate-100 dark:border-zinc-700 p-1.5 min-w-[140px] flex flex-col gap-0.5">
             {children}
          </div>
        </div>
      )}
    </div>
  );
};

const SubMenuItem = ({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700/50 hover:text-indigo-600 dark:hover:text-white rounded-lg transition-colors w-full text-left"
  >
    <Icon size={14} />
    {label}
  </button>
);

export const CanvasToolbar = () => {
  const addNode = useCanvasStore((state) => state.addNode);

  const handleAddText = () => {
    addNode({
      id: nanoid(),
      type: 'text',
      position: { x: 100 + Math.random() * 100, y: 100 + Math.random() * 100 },
      data: { content: '请输入文本...', mode: 'ai' },
    });
  };

  const handleAddImageNode = (type: string) => {
    addNode({
      id: nanoid(),
      type: 'imageGen', // Using imageGen type as placeholder
      position: { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: { prompt: type === 'upload' ? '上传图片' : '输入提示词生成图片...', model: 'default' },
    });
  };

  const handleAddVideoNode = (type: string) => {
    addNode({
      id: nanoid(),
      type: 'video',
      position: { x: 300 + Math.random() * 100, y: 300 + Math.random() * 100 },
      data: { prompt: type === 'text-to-video' ? '文生视频' : '图生视频', model: '' },
    });
  };

  const handleAddStoryboardNode = () => {
    addNode({
      id: nanoid(),
      type: 'storyboard',
      position: { x: 380 + Math.random() * 80, y: 120 + Math.random() * 80 },
      data: {
        script: '',
        mode: 'video',
        shots: [],
        isGenerating: false,
      },
    });
  };

  const handleAddModelRouterNode = () => {
    addNode({
      id: nanoid(),
      type: 'modelRouter',
      position: { x: 760 + Math.random() * 80, y: 120 + Math.random() * 80 },
      data: {
        provider: 'Custom',
        model: '',
        endpoint: '',
        requestMode: 'async',
        keyRotation: true,
        blacklistCount: 0,
        template: '{\\n  "model": "{{modelName}}",\\n  "prompt": "{{prompt}}",\\n  "ratio": "{{ratio}}",\\n  "duration": "{{duration}}"\\n}',
      },
    });
  };

  return (
    <div className="absolute left-6 top-24 flex flex-col gap-4 z-50 pointer-events-auto">
      {/* Main Tools Group */}
      <div className="flex flex-col gap-3">
        <ToolbarItem 
          icon={Type} 
          label="添加文本节点" 
          onClick={handleAddText} 
        />
        
        <ToolbarItem icon={ImageIcon}>
          <SubMenuItem icon={Upload} label="上传图片" onClick={() => handleAddImageNode('upload')} />
          <SubMenuItem icon={Wand2} label="文生图" onClick={() => handleAddImageNode('text-to-image')} />
          <SubMenuItem icon={ImageIcon} label="图生图" onClick={() => handleAddImageNode('image-to-image')} />
          <SubMenuItem icon={LayoutGrid} label="风格转换" onClick={() => handleAddImageNode('style-transfer')} />
        </ToolbarItem>

        <ToolbarItem icon={Video}>
          <SubMenuItem icon={Film} label="文生视频" onClick={() => handleAddVideoNode('text-to-video')} />
          <SubMenuItem icon={PlaySquare} label="图生视频" onClick={() => handleAddVideoNode('image-to-video')} />
          <SubMenuItem icon={Scissors} label="首尾帧视频" onClick={() => handleAddVideoNode('frame-video')} />
        </ToolbarItem>

        <ToolbarItem icon={Boxes}>
          <SubMenuItem icon={Clapperboard} label="智能分镜" onClick={handleAddStoryboardNode} />
          <SubMenuItem icon={Network} label="模型路由" onClick={handleAddModelRouterNode} />
          <SubMenuItem icon={Scissors} label="视频分析" onClick={() => {
            addNode({
              id: nanoid(),
              type: 'videoAnalyze',
              position: { x: 520 + Math.random() * 80, y: 320 + Math.random() * 80 },
              data: { threshold: 30, isExtracting: false, isExtractingVoiceover: false },
            });
          }} />
        </ToolbarItem>

        <ToolbarItem icon={Mic} label="音频生成" />
        <ToolbarItem icon={Clock} label="历史记录" />
        <ToolbarItem icon={User} label="数字人" />
        <ToolbarItem icon={LayoutGrid} label="更多工具" />
      </div>

      {/* Bottom Action */}
      <div className="mt-auto">
        <ToolbarItem icon={MessageSquare} label="AI 助手" />
      </div>
    </div>
  );
};
