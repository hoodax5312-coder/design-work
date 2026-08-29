import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { ReactNode } from 'react';
import {
  Bold,
  Code,
  DoubleQuotes,
  Heading,
  Italic,
  ListOrdered,
  ListUnordered,
  Redo,
  Strikethrough,
  Undo,
} from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { Button, Separator } from '../ui';

type KnowledgeRichTextEditorProps = {
  children?: ReactNode;
  content: string;
  onChange: (html: string) => void;
};

type ToolbarActionProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

const ToolbarAction = ({ label, active = false, disabled = false, onClick, children }: ToolbarActionProps) => (
  <Button
    type="button"
    variant="ghost"
    size="iconSm"
    aria-label={label}
    aria-pressed={active}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'h-7 w-7 shrink-0 text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]',
      active && 'bg-[var(--surface-control)] text-[var(--surface-control-foreground)] hover:bg-[var(--surface-control)] hover:text-[var(--surface-control-foreground)]',
    )}
  >
    {children}
  </Button>
);

export const KnowledgeRichTextEditor = ({ children, content, onChange }: KnowledgeRichTextEditorProps) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editorProps: {
      attributes: {
        class: 'knowledge-rich-text-content',
        'aria-label': '笔记正文',
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive('bold') ?? false,
      italic: currentEditor?.isActive('italic') ?? false,
      strike: currentEditor?.isActive('strike') ?? false,
      heading: currentEditor?.isActive('heading', { level: 2 }) ?? false,
      bulletList: currentEditor?.isActive('bulletList') ?? false,
      orderedList: currentEditor?.isActive('orderedList') ?? false,
      blockquote: currentEditor?.isActive('blockquote') ?? false,
      code: currentEditor?.isActive('code') ?? false,
      canUndo: currentEditor?.can().chain().focus().undo().run() ?? false,
      canRedo: currentEditor?.can().chain().focus().redo().run() ?? false,
    }),
  });

  if (!editor || !toolbarState) return null;

  return (
    <div className="knowledge-rich-text-editor">
      <div role="toolbar" aria-label="富文本格式" className="sticky top-0 z-10 flex h-9 items-center gap-1 overflow-x-auto border-b border-border bg-background/95 px-4 backdrop-blur-sm">
        <ToolbarAction label="粗体" active={toolbarState.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={16} /></ToolbarAction>
        <ToolbarAction label="斜体" active={toolbarState.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={16} /></ToolbarAction>
        <ToolbarAction label="删除线" active={toolbarState.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={16} /></ToolbarAction>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarAction label="二级标题" active={toolbarState.heading} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading size={16} /></ToolbarAction>
        <ToolbarAction label="无序列表" active={toolbarState.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}><ListUnordered size={16} /></ToolbarAction>
        <ToolbarAction label="有序列表" active={toolbarState.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={16} /></ToolbarAction>
        <ToolbarAction label="引用" active={toolbarState.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><DoubleQuotes size={16} /></ToolbarAction>
        <ToolbarAction label="行内代码" active={toolbarState.code} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={16} /></ToolbarAction>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarAction label="撤销" disabled={!toolbarState.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo size={16} /></ToolbarAction>
        <ToolbarAction label="重做" disabled={!toolbarState.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo size={16} /></ToolbarAction>
      </div>
      {children}
      <EditorContent editor={editor} />
    </div>
  );
};
