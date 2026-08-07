import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { type Node, type Edge } from '@xyflow/react';

export interface Workflow {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  nodes: Node[];
  edges: Edge[];
}

interface WorkflowState {
  // Current workflow
  currentWorkflow: Workflow | null;
  workflows: Workflow[];

  // History for undo/redo
  history: HistoryEntry[];
  historyIndex: number;
  maxHistoryLength: number;

  // Flags
  isUndoing: boolean;

  // Actions
  saveWorkflow: (workflow: Workflow) => void;
  loadWorkflow: (id: string) => void;
  deleteWorkflow: (id: string) => void;

  // History actions
  pushHistory: (action: string, nodes: Node[], edges: Edge[]) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  subscribeWithSelector((set, get) => ({
    currentWorkflow: null,
    workflows: [],
    history: [],
    historyIndex: -1,
    maxHistoryLength: 50,
    isUndoing: false,

    saveWorkflow: (workflow) => {
      set((state) => {
        const existingIndex = state.workflows.findIndex((w) => w.id === workflow.id);
        if (existingIndex !== -1) {
          const updated = [...state.workflows];
          updated[existingIndex] = { ...workflow, updatedAt: Date.now() };
          return { workflows: updated, currentWorkflow: updated[existingIndex] };
        }
        const newWorkflow = {
          ...workflow,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return {
          workflows: [...state.workflows, newWorkflow],
          currentWorkflow: newWorkflow,
        };
      });
    },

    loadWorkflow: (id) => {
      const workflow = get().workflows.find((w) => w.id === id);
      if (workflow) {
        set({ currentWorkflow: workflow });
      }
    },

    deleteWorkflow: (id) => {
      set((state) => ({
        workflows: state.workflows.filter((w) => w.id !== id),
        currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow,
      }));
    },

    pushHistory: (action, nodes, edges) => {
      // Don't push history while undoing/redoing
      if (get().isUndoing) return;

      set((state) => {
        // Truncate any future history if we're not at the end
        const newHistory = state.history.slice(0, state.historyIndex + 1);

        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          action,
          nodes: JSON.parse(JSON.stringify(nodes)), // Deep clone
          edges: JSON.parse(JSON.stringify(edges)),
        };

        // Limit history length
        const trimmedHistory =
          newHistory.length >= state.maxHistoryLength
            ? newHistory.slice(1)
            : newHistory;

        return {
          history: [...trimmedHistory, entry],
          historyIndex: trimmedHistory.length,
        };
      });
    },

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) return null;

      const previousIndex = historyIndex - 1;
      const entry = history[previousIndex];

      set({ historyIndex: previousIndex, isUndoing: true });

      // Reset flag after a tick
      setTimeout(() => set({ isUndoing: false }), 0);

      return entry;
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return null;

      const nextIndex = historyIndex + 1;
      const entry = history[nextIndex];

      set({ historyIndex: nextIndex, isUndoing: true });

      // Reset flag after a tick
      setTimeout(() => set({ isUndoing: false }), 0);

      return entry;
    },

    canUndo: () => {
      const { historyIndex } = get();
      return historyIndex > 0;
    },

    canRedo: () => {
      const { history, historyIndex } = get();
      return historyIndex < history.length - 1;
    },

    clearHistory: () => {
      set({ history: [], historyIndex: -1 });
    },
  }))
);
