import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { AudioNodeData } from '../../types/node.types';
import { Music, Play, Pause } from '@/lib/remixIconShim';
import { BaseNode } from './BaseNode';
import { Button } from '../ui';

type AudioNode = Node<AudioNodeData>;

export const AudioNode = memo(({ data, selected }: NodeProps<AudioNode>) => {
  return (
    <BaseNode
      selected={selected}
      theme="pink"
      icon={Music}
      title="音频生成"
      width={280}
      showSourceHandle
      showTargetHandle
    >
      <div className="p-4">
        <div className="flex items-center gap-3 rounded-md bg-muted p-3">
          <Button variant="primary" size="iconSm" className="h-8 w-8 flex-shrink-0 rounded-full" aria-label={data.isPlaying ? '暂停音频' : '播放音频'}>
            {data.isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <div className="flex-1">
            <div className="flex h-8 items-end gap-0.5 overflow-hidden rounded bg-background px-1 pb-1">
              {/* Waveform visualization */}
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 animate-waveform rounded-t bg-primary/50"
                  style={{
                    height: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>提示词:</span>
            <span className="max-w-[160px] truncate text-foreground">
              {data.prompt || '无'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>时长:</span>
            <span className="text-foreground">{data.duration}s</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
});

AudioNode.displayName = 'AudioNode';
