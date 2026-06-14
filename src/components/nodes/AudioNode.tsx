import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { AudioNodeData } from '../../types/node.types';
import { Music, Play, Pause } from 'lucide-react';
import { BaseNode } from './BaseNode';

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
        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg flex items-center gap-3">
          <button className="w-8 h-8 bg-pink-600 rounded-full flex items-center justify-center text-white hover:bg-pink-700 transition-colors flex-shrink-0">
            {data.isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <div className="flex-1">
            <div className="h-8 bg-slate-100 dark:bg-slate-700 rounded flex items-end gap-0.5 overflow-hidden px-1 pb-1">
              {/* Waveform visualization */}
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-pink-400/50 rounded-t animate-waveform"
                  style={{
                    height: `${Math.random() * 100}%`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex justify-between">
            <span>提示词:</span>
            <span className="text-slate-600 dark:text-slate-300 truncate max-w-[160px]">
              {data.prompt || '无'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>时长:</span>
            <span className="text-slate-600 dark:text-slate-300">{data.duration}s</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
});

AudioNode.displayName = 'AudioNode';
