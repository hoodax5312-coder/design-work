import { memo } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Clipboard, Copy } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { type TextNodeData } from '../../types/node.types';
import { CanvasPromptOverlay } from '../canvas/CanvasPromptOverlay';
import { useCanvasActions } from '../canvas/canvasContext';
import { NodeFrame, useEditHistory, type NodeAction } from './NodeFrame';

type CanvasTextNode = Node<TextNodeData>;

const SKELETON = ['92%', '100%', '84%', '96%', '62%'];

export const TextNode = memo(({ id, data, selected }: NodeProps<CanvasTextNode>) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const single = useCanvasStore((state) => state.selectedNodes.length <= 1);
  const { notify } = useCanvasActions();
  const editHistory = useEditHistory();
  const content = String(data.content || '');
  const generating = Boolean(data.isGenerating);
  const isSelected = Boolean(selected);

  const actions: NodeAction[] = [
    {
      id: 'copy',
      icon: Copy,
      label: '复制文本',
      disabled: !content.trim(),
      onSelect: () => void navigator.clipboard.writeText(content).then(() => notify('已复制文本'), () => notify('复制失败，请手动选择文本')),
    },
    {
      id: 'to-prompt',
      icon: Clipboard,
      label: '用作提示词',
      disabled: !content.trim(),
      onSelect: () => updateNode(id, { prompt: content }, { history: true }),
    },
  ];

  return (
    <NodeFrame
      id={id}
      kind="text"
      data={data}
      selected={isSelected}
      resize="free"
      actions={actions}
      panel={<CanvasPromptOverlay id={id} kind="text" data={data} visible={isSelected && single} />}
    >
      {generating && !content ? (
        <div className="space-y-2.5 p-4" aria-label="正在生成文本">
          {SKELETON.map((width, index) => <div key={index} className="canvas-skeleton-line h-2.5 rounded-full" style={{ width }} />)}
        </div>
      ) : (
        <textarea
          aria-label="文本内容"
          value={content}
          readOnly={!isSelected}
          tabIndex={isSelected ? 0 : -1}
          onFocus={editHistory.onFocus}
          onChange={(event) => {
            editHistory.beforeChange();
            updateNode(id, { content: event.target.value });
          }}
          placeholder={isSelected ? '直接书写，或在下方让模型生成…' : '空白文本'}
          className={cn(
            'nokey block h-full w-full resize-none bg-transparent p-4 text-[13px] leading-6 text-foreground outline-none placeholder:text-muted-foreground/70',
            isSelected ? 'nodrag nowheel cursor-text' : 'pointer-events-none select-none',
            generating && 'opacity-60',
          )}
        />
      )}
    </NodeFrame>
  );
});

TextNode.displayName = 'TextNode';
