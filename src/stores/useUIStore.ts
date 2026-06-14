import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelType = 'assets' | 'workflow' | 'history' | 'tools' | null;
export type ModalType = 'workflow' | 'settings' | null;

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
  | 'new-chat'
  | 'magic-canvas'
  | 'agents'
  | 'assets'
  | 'image-gen'
  | 'video-gen'
  | 'projects'
  | 'inspiration'
  | 'tools'
  | 'ecommerce';

interface UIState {
  activePanel: PanelType;
  modalOpen: ModalType;
  contextMenu: ContextMenuState | null;
  theme: 'dark' | 'light';
  
  // Project Sidebar State
  projectSidebarOpen: boolean;
  activeModule: ModuleType;
  
  // Actions
  setActivePanel: (panel: PanelType) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  showContextMenu: (x: number, y: number, options: MenuOption[]) => void;
  hideContextMenu: () => void;
  
  toggleProjectSidebar: () => void;
  setProjectSidebarOpen: (open: boolean) => void;
  setActiveModule: (module: ModuleType) => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(persist((set) => ({
  activePanel: null,
  modalOpen: null,
  contextMenu: null,
  theme: 'light',
  
  projectSidebarOpen: true,
  activeModule: 'new-chat',

  setActivePanel: (panel) => set({ activePanel: panel }),
  openModal: (modal) => set({ modalOpen: modal }),
  closeModal: () => set({ modalOpen: null }),
  showContextMenu: (x, y, options) => set({ contextMenu: { x, y, options } }),
  hideContextMenu: () => set({ contextMenu: null }),
  
  toggleProjectSidebar: () => set((state) => ({ projectSidebarOpen: !state.projectSidebarOpen })),
  setProjectSidebarOpen: (open) => set({ projectSidebarOpen: open }),
  setActiveModule: (module) => set({ activeModule: module }),
  
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
  name: 'mboard-ui',
  version: 1,
  migrate: (persistedState) => {
    const previous = persistedState as Partial<UIState> | undefined;
    return {
    theme: previous?.theme || 'light',
    projectSidebarOpen: previous?.projectSidebarOpen ?? true,
    activeModule: 'new-chat',
  };
  },
  partialize: (state) => ({
    theme: state.theme,
    projectSidebarOpen: state.projectSidebarOpen,
    activeModule: state.activeModule,
  }),
  onRehydrateStorage: () => (state) => {
    document.documentElement.classList.toggle('dark', state?.theme === 'dark');
  },
}));
