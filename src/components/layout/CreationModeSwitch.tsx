import { useUIStore } from '../../stores/useUIStore';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';

export const CreationModeSwitch = () => {
  const generationMode = useUIStore((state) => state.generationMode);
  const setGenerationMode = useUIStore((state) => state.setGenerationMode);

  return (
    <nav aria-label="生成类型" className="absolute inset-x-0 top-0 z-[70] flex h-14 items-center bg-transparent px-3 text-foreground">
      <Tabs value={generationMode} onValueChange={(value) => setGenerationMode(value as 'image' | 'video')}>
        <TabsList className="h-8 gap-1 rounded-none border-0 bg-transparent p-0 shadow-none">
          <TabsTrigger value="image" className="h-8 border-0 bg-transparent px-4 py-0 text-sm text-muted-foreground shadow-none focus-visible:ring-offset-0 data-[state=inactive]:hover:text-foreground data-[state=active]:!bg-[var(--surface-control)] data-[state=active]:!text-[var(--surface-control-foreground)] data-[state=active]:!shadow-none">
            图片生成
          </TabsTrigger>
          <TabsTrigger value="video" className="h-8 border-0 bg-transparent px-4 py-0 text-sm text-muted-foreground shadow-none focus-visible:ring-offset-0 data-[state=inactive]:hover:text-foreground data-[state=active]:!bg-[var(--surface-control)] data-[state=active]:!text-[var(--surface-control-foreground)] data-[state=active]:!shadow-none">
            视频生成
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </nav>
  );
};
