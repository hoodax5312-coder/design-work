import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelType = 'assets' | 'workflow' | 'history' | 'tools' | null;
export type ModalType = 'workflow' | 'settings' | null;
export type WorkspaceMode = 'editor' | 'manager';
export type GenerationMode = 'image' | 'video';

export interface MenuOption {
  label: string;
  action: () => void;
  icon?: React.ElementType;
}

export interface ContextMenuState {
  x: number;
  y: number;
  options: MenuOption[];
}

export type ModuleType =
  | 'magic-canvas'
  | 'assets'
  | 'image-gen'
  | 'ppt-gen'
  | 'video-gen'
  | 'projects'
  | 'tools'
  | 'ecommerce'
  | 'sources'
  | 'exports';

interface UIState {
  activePanel: PanelType;
  modalOpen: ModalType;
  contextMenu: ContextMenuState | null;
  theme: 'dark' | 'light';
  
  // Project Sidebar State
  projectSidebarOpen: boolean;
  activeModule: ModuleType;
  workspaceMode: WorkspaceMode;
  rightPanelOpen: boolean;
  generationMode: GenerationMode;
  
  // Actions
  setActivePanel: (panel: PanelType) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  showContextMenu: (x: number, y: number, options: MenuOption[]) => void;
  hideContextMenu: () => void;
  
  toggleProjectSidebar: () => void;
  setProjectSidebarOpen: (open: boolean) => void;
  setActiveModule: (module: ModuleType) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  setGenerationMode: (mode: GenerationMode) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(persist((set) => ({
  activePanel: null,
  modalOpen: null,
  contextMenu: null,
  theme: 'dark',
  
  projectSidebarOpen: true,
  activeModule: 'assets',
  workspaceMode: 'editor',
  rightPanelOpen: true,
  generationMode: 'image',

  setActivePanel: (panel) => set({ activePanel: panel }),
  openModal: (modal) => set({ modalOpen: modal }),
  closeModal: () => set({ modalOpen: null }),
  showContextMenu: (x, y, options) => set({ contextMenu: { x, y, options } }),
  hideContextMenu: () => set({ contextMenu: null }),
  
  toggleProjectSidebar: () => set((state) => ({ projectSidebarOpen: !state.projectSidebarOpen })),
  setProjectSidebarOpen: (open) => set({ projectSidebarOpen: open }),
  setActiveModule: (module) => set({ activeModule: module }),
  setWorkspaceMode: (mode) => set({ workspaceMode: mode }),
  setGenerationMode: (mode) => set({ generationMode: mode }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme: newTheme };
  }),
}), {
  name: 'design-work-ui',
  version: 4,
  migrate: (persistedState) => {
    const previous = persistedState as Partial<UIState> | undefined;
    return {
    // The visual system now uses a dark spatial canvas by default. Users can still
    // switch appearance after the migration from the sidebar.
    theme: 'dark' as const,
    projectSidebarOpen: previous?.projectSidebarOpen ?? true,
    activeModule: 'assets' as ModuleType,
    workspaceMode: 'editor' as WorkspaceMode,
    rightPanelOpen: previous?.rightPanelOpen ?? true,
  };
  },
  partialize: (state) => ({
    theme: state.theme,
    projectSidebarOpen: state.projectSidebarOpen,
    rightPanelOpen: state.rightPanelOpen,
  }),
  onRehydrateStorage: () => (state) => {
    document.documentElement.classList.toggle('dark', state?.theme === 'dark');
  },
}));
