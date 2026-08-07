import { memo, useMemo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Clapperboard, Loader2, Plus, Sparkles, Wand2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { StoryboardNodeData, StoryboardShot } from '../../types/node.types';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { Badge, Button, Card, Tabs, TabsList, TabsTrigger, Textarea } from '../ui';

type StoryboardNode = Node<StoryboardNodeData>;

const cameras = ['缓慢推进', '横向平移', '低角度推近', '景深拉焦', '静态远景', '轻微环绕'];

const createShotsFromScript = (script: string, mode: 'image' | 'video'): StoryboardShot[] => {
  const source = script.trim() || '一个角色进入陌生空间，发现线索，做出选择，最终完成转变。';
  const chunks = source
    .split(/[。！？.!?\n]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 6);
  const seeds = chunks.length >= 3 ? chunks : [
    '开场建立场景与主角状态',
    '关键冲突出现，主角开始行动',
    '情绪进入高潮，画面出现转折',
    '结尾收束主题，留下记忆点',
  ];

  return seeds.map((scene, index) => ({
    id: `shot-${index + 1}`,
    scene: `镜头 ${String(index + 1).padStart(2, '0')}`,
    prompt: `${mode === 'video' ? 'cinematic video shot' : 'storyboard frame'}, ${scene}, clear subject, rich lighting, professional composition`,
    camera: cameras[index % cameras.length],
    duration: mode === 'video' ? 5 : 0,
    status: 'ready',
  }));
};

export const StoryboardNode = memo(({ id, data, selected }: NodeProps<StoryboardNode>) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const addNode = useCanvasStore((state) => state.addNode);
  const addEdge = useCanvasStore((state) => state.onConnect);

  const readyCount = useMemo(
    () => (data.shots || []).filter((shot) => shot.status === 'ready' || shot.status === 'done').length,
    [data.shots],
  );

  const handleSplit = () => {
    updateNode(id, { isGenerating: true });
    window.setTimeout(() => {
      updateNode(id, {
        isGenerating: false,
        shots: createShotsFromScript(data.script || '', data.mode || 'video'),
      });
    }, 420);
  };

  const handleCreateShotNodes = () => {
    const shots = data.shots || [];
    shots.forEach((shot, index) => {
      const nodeId = `${id}-${shot.id}-${data.mode || 'video'}`;
      addNode({
        id: nodeId,
        type: data.mode === 'image' ? 'imageGen' : 'video',
        position: { x: 460, y: 80 + index * 190 },
        data: data.mode === 'image'
          ? { prompt: shot.prompt, model: 'mj-v7', style: 'storyboard', resolution: '1k', aspectRatio: '16:9', isFocusMode: false }
          : { prompt: `${shot.prompt}. Camera movement: ${shot.camera}`, model: 'kling', duration: shot.duration || 5, aspectRatio: '16:9', resolution: '1080p' },
      });
      addEdge({ source: id, target: nodeId, sourceHandle: null, targetHandle: null });
    });
    updateNode(id, {
      shots: shots.map((shot) => ({ ...shot, status: 'queued' })),
    });
  };

  return (
    <BaseNode
      selected={selected}
      theme="green"
      icon={Clapperboard}
      title="智能分镜"
      width={380}
      showSourceHandle
      showTargetHandle
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Tabs value={data.mode || 'video'} onValueChange={(mode) => updateNode(id, { mode: mode as 'video' | 'image' })}><TabsList><TabsTrigger value="video" className="text-xs">视频分镜</TabsTrigger><TabsTrigger value="image" className="text-xs">图片分镜</TabsTrigger></TabsList></Tabs>
          <Badge variant="secondary">{readyCount}/{(data.shots || []).length || 0}</Badge>
        </div>

        <Textarea
          value={data.script || ''}
          onChange={(event) => updateNode(id, { script: event.target.value })}
          placeholder="粘贴小说、广告脚本或剧情大纲，自动拆成镜头..."
          className="nodrag h-24 text-xs leading-5"
        />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" size="sm"
            onClick={handleSplit}
            disabled={data.isGenerating}
            className="nodrag text-xs"
          >
            {data.isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            拆分脚本
          </Button>
          <Button variant="secondary" size="sm"
            onClick={handleCreateShotNodes}
            disabled={!data.shots?.length}
            className="nodrag text-xs"
          >
            <Plus className="h-3 w-3" />
            生成镜头节点
          </Button>
        </div>

        {data.shots?.length ? (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {data.shots.map((shot) => (
              <Card key={shot.id} padding="sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold">{shot.scene}</span>
                  <Badge variant="secondary" className="text-xs">
                    {shot.status === 'queued' ? '已入队' : shot.status === 'done' ? '完成' : '就绪'}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">{shot.prompt}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  {shot.camera}{shot.duration ? ` · ${shot.duration}s` : ''}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            等待拆分镜头
          </div>
        )}
      </div>
    </BaseNode>
  );
});

StoryboardNode.displayName = 'StoryboardNode';
