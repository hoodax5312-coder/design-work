import { useRef } from 'react';
import { ChevronDown, FolderInput, Save, Trash2, Undo, Redo } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';

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
    localStorage.setItem('mboard:last-workflow', JSON.stringify(payload));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mboard-workflow-${Date.now()}.json`;
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
            window.alert('导入失败，请选择有效的 Mboard 工作流 JSON 文件。');
          });
          event.target.value = '';
        }}
      />
       {/* Left: Toolbar */}
      <div className="pointer-events-auto flex items-center gap-2 bg-[#edf1f5] dark:bg-zinc-800 p-1 rounded-xl shadow-sm border border-white/50 dark:border-white/10 backdrop-blur-sm transition-colors">
         {/* Project Name */}
         <button className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-lg hover:bg-white/80 dark:hover:bg-zinc-800 transition-colors text-slate-700 dark:text-zinc-200 shadow-sm border border-slate-100 dark:border-zinc-700">
            <span className="font-medium text-sm">未命名项目</span>
            <ChevronDown size={14} className="opacity-50" />
         </button>
      </div>

      {/* Right: Extra Actions */}
      <div className="pointer-events-auto flex items-center gap-2">
         {/* History */}
         <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700 transition-colors">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="p-1.5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-35 disabled:hover:bg-transparent"
              title="撤销"
            >
              <Undo size={16} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="p-1.5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-35 disabled:hover:bg-transparent"
              title="重做"
            >
              <Redo size={16} />
            </button>
         </div>

         {/* Actions */}
         <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700 transition-colors">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-2 py-1.5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-md transition-colors"
            >
              <FolderInput size={16} />
              <span className="text-xs font-medium">导入</span>
            </button>
            <button
              onClick={exportWorkflow}
              className="flex items-center gap-2 px-2 py-1.5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-md transition-colors"
            >
              <Save size={16} />
              <span className="text-xs font-medium">存储</span>
            </button>
            <button
              onClick={() => {
                if (nodes.length === 0 && edges.length === 0) return;
                if (window.confirm('确定清空当前画布吗？')) clearCanvas();
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-md transition-colors"
            >
              <Trash2 size={16} />
              <span className="text-xs font-medium">清空</span>
            </button>
         </div>
       </div>
    </div>
  );
};
