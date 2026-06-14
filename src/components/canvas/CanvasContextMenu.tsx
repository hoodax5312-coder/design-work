import { useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useReactFlow } from '@xyflow/react';
import { Type, Image as ImageIcon, Video, Music, Upload } from 'lucide-react';

export const CanvasContextMenu = () => {
  const { contextMenu, hideContextMenu } = useUIStore();
  const { addNode: addNodeStore } = useCanvasStore();
  const { screenToFlowPosition } = useReactFlow();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        hideContextMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hideContextMenu]);

  if (!contextMenu) return null;

  const handleAddNode = (type: string) => {
    const position = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });
    
    let label = '新节点';
    switch(type) {
      case 'text': label = '新文本节点'; break;
      case 'imageGen': label = '新图像生成节点'; break;
      case 'video': label = '新视频节点'; break;
      case 'audio': label = '新音频节点'; break;
    }

    const newNode = {
      id: crypto.randomUUID(),
      type,
      position,
      data: { label }, // Initial data
    };

    addNodeStore(newNode);
    hideContextMenu();
  };

  return (
    <div
      ref={menuRef}
      style={{ top: contextMenu.y, left: contextMenu.x }}
      className="fixed z-50 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1 animate-fade-in flex flex-col gap-1"
    >
      <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
        添加节点
      </div>
      
      {[
        { id: 'text', label: '文本节点', icon: Type, color: 'text-accent-cyan' },
        { id: 'imageGen', label: '图像生成', icon: ImageIcon, color: 'text-emerald-400' },
        { id: 'video', label: '视频节点', icon: Video, color: 'text-accent-purple' },
        { id: 'audio', label: '音频节点', icon: Music, color: 'text-blue-400' },
        { id: 'upload', label: '上传媒体', icon: Upload, color: 'text-zinc-400' },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => handleAddNode(item.id)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-sm text-left"
        >
          <item.icon size={16} className={item.color} />
          {item.label}
        </button>
      ))}
    </div>
  );
};
