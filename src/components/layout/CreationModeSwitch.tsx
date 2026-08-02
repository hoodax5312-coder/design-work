import { Image as ImageIcon, Infinity as InfinityIcon, Video } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';

export const CreationModeSwitch = () => {
  const { activeModule, generationMode, setActiveModule, setGenerationMode, setWorkspaceMode } = useUIStore();
  const openGeneration = (mode: 'image' | 'video') => {
    setGenerationMode(mode);
    setWorkspaceMode('editor');
    setActiveModule('image-gen');
  };
  const openCanvas = () => {
    setWorkspaceMode('editor');
    setActiveModule('magic-canvas');
  };
  const imageActive = activeModule === 'image-gen' && generationMode === 'image';
  const videoActive = activeModule === 'image-gen' && generationMode === 'video';
  return (
    <nav aria-label="创作方式" className="absolute inset-x-0 top-0 z-[70] flex h-14 items-center justify-center border-0 bg-white text-zinc-950 shadow-none dark:bg-[#0b0b0b] dark:text-zinc-50">
      <Tabs value={imageActive ? 'image' : videoActive ? 'video' : 'canvas'} onValueChange={(value) => value === 'canvas' ? openCanvas() : openGeneration(value as 'image' | 'video')}>
      <TabsList className="h-8 rounded-lg border-0 bg-muted p-0.5 shadow-none">
        <TabsTrigger value="image" aria-label="图像生成" className="h-7 gap-2 border-0 px-3 text-xs text-zinc-500 shadow-none data-[state=active]:!bg-background data-[state=active]:!text-foreground data-[state=active]:!shadow-sm dark:text-zinc-400 sm:px-4">
          <ImageIcon aria-hidden="true" size={15} /> <span className="hidden sm:inline">图像生成</span>
        </TabsTrigger>
        <TabsTrigger value="video" aria-label="视频生成" className="h-7 gap-2 border-0 px-3 text-xs text-zinc-500 shadow-none data-[state=active]:!bg-background data-[state=active]:!text-foreground data-[state=active]:!shadow-sm dark:text-zinc-400 sm:px-4">
          <Video aria-hidden="true" size={15} /> <span className="hidden sm:inline">视频生成</span>
        </TabsTrigger>
        <TabsTrigger value="canvas" aria-label="无限画布" className="h-7 gap-2 border-0 px-3 text-xs text-zinc-500 shadow-none data-[state=active]:!bg-background data-[state=active]:!text-foreground data-[state=active]:!shadow-sm dark:text-zinc-400 sm:px-4">
          <InfinityIcon aria-hidden="true" size={16} /> <span className="hidden sm:inline">无限画布</span>
        </TabsTrigger>
      </TabsList>
      </Tabs>
    </nav>
  );
};
