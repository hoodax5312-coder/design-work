import { useRef } from 'react';
import { ChevronDown, FolderInput, Save, Trash2, Undo, Redo } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { Button, Card, Separator } from '../ui';

export const CanvasHeader = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    clearCanvas,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvasStore();

  const exportWorkflow = () => {
    const payload = {
      name: '未命名项目',
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
    };
    localStorage.setItem('design-work:last-workflow', JSON.stringify(payload));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `design-work-workflow-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importWorkflow = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text) as { nodes?: typeof nodes; edges?: typeof edges };
    if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
      throw new Error('Invalid workflow file');
    }
    setNodes(payload.nodes);
    setEdges(payload.edges);
  };

  return (
    <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-50">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          importWorkflow(event.target.files?.[0]).catch(() => {
            window.alert('导入失败，请选择有效的 Design Work 工作流 JSON 文件。');
          });
          event.target.value = '';
        }}
      />
       {/* Left: Toolbar */}
      <Card padding="sm" className="pointer-events-auto flex items-center gap-2 p-1">
         {/* Project Name */}
         <Button variant="ghost" size="sm">
            <span className="font-medium text-sm">未命名项目</span>
            <ChevronDown size={14} className="opacity-50" />
         </Button>
      </Card>

      {/* Right: Extra Actions */}
      <div className="pointer-events-auto flex items-center gap-2">
         {/* History */}
         <Card padding="sm" className="flex items-center gap-1 p-1">
            <Button variant="ghost" size="iconSm"
              onClick={undo}
              disabled={!canUndo()}
              title="撤销"
            >
              <Undo size={16} />
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Button variant="ghost" size="iconSm"
              onClick={redo}
              disabled={!canRedo()}
              title="重做"
            >
              <Redo size={16} />
            </Button>
         </Card>

         {/* Actions */}
         <Card padding="sm" className="flex items-center gap-1 p-1">
            <Button variant="ghost" size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderInput size={16} />
              <span className="text-xs font-medium">导入</span>
            </Button>
            <Button variant="ghost" size="sm"
              onClick={exportWorkflow}
            >
              <Save size={16} />
              <span className="text-xs font-medium">存储</span>
            </Button>
            <Button variant="ghost" size="sm"
              onClick={() => {
                if (nodes.length === 0 && edges.length === 0) return;
                if (window.confirm('确定清空当前画布吗？')) clearCanvas();
              }}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={16} />
              <span className="text-xs font-medium">清空</span>
            </Button>
         </Card>
       </div>
    </div>
  );
};
