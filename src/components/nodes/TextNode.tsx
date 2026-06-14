import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { TextNodeData } from '../../types/node.types';
import { Type, Image as ImageIcon, Video, Edit3 } from 'lucide-react';
import { BaseNode } from './BaseNode';

type TextNode = Node<TextNodeData>;

export const TextNode = memo(({ data, selected }: NodeProps<TextNode>) => {
  return (
    <div className="relative">
      <BaseNode
        selected={selected}
        theme="indigo"
        icon={Type}
        title="文本"
        width={320}
        showSourceHandle
        showTargetHandle={false}
      >
        <div className="p-4 min-h-[120px]">
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {data.content || '请输入描述文本...'}
          </div>
        </div>
      </BaseNode>

      {/* Quick Actions (Visible when selected) */}
      {selected && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 flex flex-col gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
          <QuickActionButton icon={ImageIcon} label="生成图片" />
          <QuickActionButton icon={Video} label="生成视频" />
          <QuickActionButton icon={Edit3} label="编辑节点" />
        </div>
      )}
    </div>
  );
});

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-slate-100 dark:border-zinc-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:scale-110 transition-all group/btn relative"
    >
      <Icon size={18} />
      <span className="absolute left-full ml-2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover/btn:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
        {label}
      </span>
    </button>
  );
}

TextNode.displayName = 'TextNode';
