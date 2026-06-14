import { useCallback } from 'react';
import { ReactFlow, Background, MiniMap, BackgroundVariant, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore } from '../../stores/useCanvasStore';
import { useUIStore } from '../../stores/useUIStore';
import { CanvasControls } from './CanvasControls';
import { CanvasContextMenu } from './CanvasContextMenu';
import { CanvasHeader } from './CanvasHeader';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasFooter } from './CanvasFooter';
import { TextNode } from '../nodes/TextNode';
import { VideoNode } from '../nodes/VideoNode';
import { AudioNode } from '../nodes/AudioNode';
import { ImageGenNode } from '../nodes/ImageGenNode';
import { VideoAnalyzeNode } from '../nodes/VideoAnalyzeNode';
import { StoryboardNode } from '../nodes/StoryboardNode';
import { ModelRouterNode } from '../nodes/ModelRouterNode';

const nodeTypes = {
  text: TextNode,
  video: VideoNode,
  audio: AudioNode,
  imageGen: ImageGenNode,
  videoAnalyze: VideoAnalyzeNode,
  storyboard: StoryboardNode,
  modelRouter: ModelRouterNode,
} satisfies NodeTypes;

export const Canvas = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    showMinimap,
    showGrid,
    gridSize
  } = useCanvasStore();
  
  const { showContextMenu, theme } = useUIStore();

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if ((event.target as HTMLElement).classList.contains('react-flow__pane')) {
      showContextMenu(event.clientX, event.clientY, []);
    }
  }, [showContextMenu]);

  return (
    <div className="w-full h-full bg-white dark:bg-black transition-colors" onDoubleClick={handleDoubleClick}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        className="bg-white dark:bg-black transition-colors"
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        {showGrid && (
          <Background
            color={theme === 'dark' ? '#333' : '#cbd5e1'}
            gap={gridSize}
            size={1.5}
            variant={BackgroundVariant.Dots}
            className="opacity-50"
          />
        )}
        
        {showMinimap && (
          <MiniMap
            className="!bg-white/95 dark:!bg-zinc-800/95 !border-slate-200 dark:!border-zinc-700 !rounded-xl overflow-hidden !shadow-xl !right-4 !bottom-20 !left-auto !top-auto"
            nodeColor={(node) => {
              switch (node.type) {
                case 'text':
                  return '#6366f1';
                case 'video':
                  return '#f59e0b';
                case 'imageGen':
                  return '#8b5cf6';
                case 'audio':
                  return '#06b6d4';
                case 'videoAnalyze':
                  return '#10b981';
                default:
                  return theme === 'dark' ? '#52525b' : '#94a3b8';
              }
            }}
            nodeStrokeWidth={3}
            maskColor={theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)'}
            position="bottom-right"
            pannable
            zoomable
            style={{ width: 180, height: 120 }}
          />
        )}
        
        <CanvasControls />
        <CanvasContextMenu />
      </ReactFlow>
      
      {/* Floating UI Elements */}
      <div className="absolute inset-0 z-50 pointer-events-none">
        <CanvasHeader />
        <CanvasToolbar />
        <CanvasFooter />
      </div>
    </div>
  );
};
