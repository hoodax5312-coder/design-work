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
  Scissors,
  Clapperboard,
  Network,
  Boxes
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { nanoid } from 'nanoid';
import { Button, Card } from '../ui';

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
      <Button
        variant={active ? 'primary' : 'secondary'}
        size="iconLg"
        onClick={onClick}
        className="group relative z-20"
        aria-label={label}
      >
        <Icon size={20} strokeWidth={2} />
        
        {/* Tooltip Label (Only if no children/submenu) */}
        {!children && isHovered && label && (
          <div className="absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in slide-in-from-left-2">
            {label}
          </div>
        )}
      </Button>

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
          <Card padding="sm" className="flex min-w-[140px] flex-col gap-0.5 p-1.5 shadow-lg">
             {children}
          </Card>
        </div>
      )}
    </div>
  );
};

const SubMenuItem = ({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) => (
  <Button
    variant="ghost"
    size="sm"
    onClick={onClick}
    className="w-full justify-start text-xs"
  >
    <Icon size={14} />
    {label}
  </Button>
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

  const handleAddImageNode = () => {
    addNode({
      id: nanoid(),
      type: 'imageGen', // Using imageGen type as placeholder
      position: { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: { prompt: '', model: 'default' },
    });
  };

  const handleAddVideoNode = () => {
    addNode({
      id: nanoid(),
      type: 'video',
      position: { x: 300 + Math.random() * 100, y: 300 + Math.random() * 100 },
      data: { prompt: '', model: '' },
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
        
        <ToolbarItem icon={ImageIcon} label="添加图片节点" onClick={handleAddImageNode} />

        <ToolbarItem icon={Video} label="添加视频节点" onClick={handleAddVideoNode} />

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
