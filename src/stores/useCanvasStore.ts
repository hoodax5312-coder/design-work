import { create } from 'zustand';
import { type Node, type Edge, type Viewport, addEdge, applyNodeChanges, applyEdgeChanges, type Connection, type NodeChange, type EdgeChange } from '@xyflow/react';

interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  undoStack: CanvasSnapshot[];
  redoStack: CanvasSnapshot[];
  selectedNodes: string[];
  viewport: Viewport;
  showMinimap: boolean;
  showGrid: boolean;
  zoomLevel: number;
  gridSize: number;

  // Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  setViewport: (viewport: Viewport) => void;
  toggleMinimap: () => void;
  toggleGrid: () => void;
  setZoom: (level: number) => void;
  snapNodesToGrid: () => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // For undo/redo support
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  restoreSnapshot: (nodes: Node[], edges: Edge[]) => void;
  getSnapshot: () => { nodes: Node[]; edges: Edge[] };
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  undoStack: [],
  redoStack: [],
  edges: [],
  selectedNodes: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  showMinimap: false,
  showGrid: true,
  zoomLevel: 1,
  gridSize: 20,

  onNodesChange: (changes) => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
      redoStack: [],
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },
  onEdgesChange: (changes) => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
      redoStack: [],
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },
  onConnect: (connection) => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
      redoStack: [],
      edges: addEdge(connection, state.edges),
    }));
  },
  addNode: (node) => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
      redoStack: [],
      nodes: [...state.nodes, node],
    }));
  },
  updateNode: (id, data) => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
      redoStack: [],
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    }));
  },
  deleteNode: (id) => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
      redoStack: [],
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
    }));
  },
  setViewport: (viewport) => set({ viewport }),
  toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setZoom: (level) => set({ zoomLevel: level }),
  snapNodesToGrid: () => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
      redoStack: [],
      nodes: state.nodes.map((node) => ({
        ...node,
        position: {
          x: Math.round(node.position.x / state.gridSize) * state.gridSize,
          y: Math.round(node.position.y / state.gridSize) * state.gridSize,
        },
      })),
    }));
  },
  clearCanvas: () => {
    set((state) => ({
      undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
      redoStack: [],
      nodes: [],
      edges: [],
    }));
  },
  undo: () => {
    set((state) => {
      const previous = state.undoStack[state.undoStack.length - 1];
      if (!previous) return state;
      return {
        nodes: previous.nodes,
        edges: previous.edges,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, { nodes: state.nodes, edges: state.edges }],
      };
    });
  },
  redo: () => {
    set((state) => {
      const next = state.redoStack[state.redoStack.length - 1];
      if (!next) return state;
      return {
        nodes: next.nodes,
        edges: next.edges,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }],
      };
    });
  },
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // For undo/redo support
  setNodes: (nodes) => set((state) => ({
    undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
    redoStack: [],
    nodes,
  })),
  setEdges: (edges) => set((state) => ({
    undoStack: [...state.undoStack.slice(-49), { nodes: state.nodes, edges: state.edges }],
    redoStack: [],
    edges,
  })),
  restoreSnapshot: (nodes, edges) => set({ nodes, edges }),
  getSnapshot: () => ({ nodes: get().nodes, edges: get().edges }),
}));
