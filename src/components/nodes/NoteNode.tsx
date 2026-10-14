import { memo, useEffect, useRef, useState } from 'react';
import { NodeResizer, NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react';
import { Lock } from '@/lib/remixIconShim';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { motion, springs } from '../motion';
import { Tooltip } from '../ui';
import { NOTE_TINTS, type NoteTint } from '../canvas/canvasModel';
import { NodeMenu, ToolbarDivider, useEditHistory } from './NodeFrame';

type NoteNodeData = { content?: string; tint?: NoteTint; locked?: boolean } & Record<string, unknown>;
type NoteNodeType = Node<NoteNodeData>;

const NOTE_TINT_LABEL: Record<NoteTint, string> = { neutral: '灰', amber: '黄', sky: '蓝', mint: '绿', rose: '粉' };

const isNoteTint = (value: unknown): value is NoteTint => NOTE_TINTS.includes(value as NoteTint);

/** 便签：画布上的批注，不参与生成与连线。默认只读以便拖动，双击进入编辑。 */
export const NoteNode = memo(({ id, data, selected }: NodeProps<NoteNodeType>) => {
  const single = useCanvasStore((state) => state.selectedNodes.length <= 1);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const commit = useCanvasStore((state) => state.commit);
  const history = useEditHistory();
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const content = String(data.content || '');
  const tint = isNoteTint(data.tint) ? data.tint : 'amber';
  const locked = Boolean(data.locked);

  useEffect(() => {
    const element = textareaRef.current;
    if (!editing || !element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, [editing]);

  return (
    <>
      <NodeToolbar isVisible={Boolean(selected) && single} position={Position.Top} offset={12} align="center" className="!p-0">
        <div className="canvas-chrome nodrag nopan flex items-center gap-0.5 rounded-lg p-1" onDoubleClick={(event) => event.stopPropagation()}>
          {NOTE_TINTS.map((item) => (
            <Tooltip key={item} content={`${NOTE_TINT_LABEL[item]}色`}>
              <button
                type="button"
                className="canvas-note-swatch"
                data-tint={item}
                data-active={item === tint || undefined}
                aria-label={`便签颜色：${NOTE_TINT_LABEL[item]}`}
                aria-pressed={item === tint}
                onClick={() => { if (item !== tint) updateNode(id, { tint: item }, { history: true }); }}
              />
            </Tooltip>
          ))}
          <ToolbarDivider />
          <NodeMenu id={id} locked={locked} />
        </div>
      </NodeToolbar>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springs.bouncy}
        className="canvas-note"
        data-tint={tint}
        data-editing={editing || undefined}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onFocus={history.onFocus}
            onChange={(event) => {
              history.beforeChange();
              updateNode(id, { content: event.target.value });
            }}
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.currentTarget.blur();
            }}
            aria-label="便签内容"
            placeholder="写点什么…"
            className="canvas-note-text nodrag nowheel nokey"
          />
        ) : content.trim() ? (
          <div className="canvas-note-text">{content}</div>
        ) : (
          <div className="canvas-note-text canvas-note-placeholder">双击编辑</div>
        )}
        {locked && (
          <Tooltip content="已锁定：不可拖动、缩放或删除" side="top">
            <span className="canvas-note-lock"><Lock size={12} /></span>
          </Tooltip>
        )}
      </motion.div>

      {selected && !locked && (
        <NodeResizer
          minWidth={160}
          minHeight={120}
          maxWidth={720}
          maxHeight={720}
          handleClassName="canvas-resize-handle"
          lineClassName="canvas-resize-line"
          onResizeStart={commit}
        />
      )}
    </>
  );
});

NoteNode.displayName = 'NoteNode';
