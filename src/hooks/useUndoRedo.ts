import { useCallback, useEffect } from 'react';
import { useCanvasStore } from '../stores/useCanvasStore';
import { useWorkflowStore } from '../stores/useWorkflowStore';

/**
 * Hook for managing undo/redo functionality
 * Integrates canvas state with workflow history
 */
export function useUndoRedo() {
  const { restoreSnapshot, getSnapshot } = useCanvasStore();
  const { pushHistory, undo, redo, canUndo, canRedo, history, historyIndex } =
    useWorkflowStore();

  // Save current state to history
  const saveToHistory = useCallback(
    (action: string) => {
      const snapshot = getSnapshot();
      pushHistory(action, snapshot.nodes, snapshot.edges);
    },
    [getSnapshot, pushHistory]
  );

  // Perform undo
  const handleUndo = useCallback(() => {
    const entry = undo();
    if (entry) {
      restoreSnapshot(entry.nodes, entry.edges);
    }
  }, [undo, restoreSnapshot]);

  // Perform redo
  const handleRedo = useCallback(() => {
    const entry = redo();
    if (entry) {
      restoreSnapshot(entry.nodes, entry.edges);
    }
  }, [redo, restoreSnapshot]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return {
    // Actions
    saveToHistory,
    undo: handleUndo,
    redo: handleRedo,

    // State
    canUndo: canUndo(),
    canRedo: canRedo(),
    historyLength: history.length,
    currentIndex: historyIndex,
  };
}
