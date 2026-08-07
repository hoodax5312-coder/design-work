import { useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useReactFlow } from '@xyflow/react';
import { Type, Image as ImageIcon, Video, Music, Upload } from 'lucide-react';
import { Button, Card } from '../ui';

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
      className="fixed z-50"
    >
      <Card padding="sm" className="flex w-48 animate-fade-in flex-col gap-1 p-1 shadow-lg">
      <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        添加节点
      </div>
      
      {[
        { id: 'text', label: '文本节点', icon: Type, color: 'text-foreground' },
        { id: 'imageGen', label: '图像生成', icon: ImageIcon, color: 'text-emerald-400' },
        { id: 'video', label: '视频节点', icon: Video, color: 'text-foreground' },
        { id: 'audio', label: '音频节点', icon: Music, color: 'text-blue-400' },
        { id: 'upload', label: '上传媒体', icon: Upload, color: 'text-muted-foreground' },
      ].map((item) => (
        <Button
          key={item.id}
          variant="ghost"
          size="sm"
          onClick={() => handleAddNode(item.id)}
          className="w-full justify-start gap-3 text-sm"
        >
          <item.icon size={16} className={item.color} />
          {item.label}
        </Button>
      ))}
      </Card>
    </div>
  );
};
