import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelType = 'assets' | 'workflow' | 'history' | 'tools' | null;
export type ModalType = 'workflow' | null;
export type WorkspaceMode = 'editor' | 'manager';
export type GenerationMode = 'image' | 'video';
export type ThemePreset = 'nature';
export type FontPreset = 'theme-default' | 'noto-sans' | 'noto-serif' | 'zcool-xiaowei';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ContentLayout = 'centered' | 'full';
export type TopNavigationMode = 'scroll' | 'fixed';
export type SidebarStyle = 'embedded' | 'standard' | 'floating';
export type SidebarCollapseMode = 'icons' | 'hidden';
export type AppLanguage = 'zh-CN' | 'en-US';
export type InterfaceStyle = 'calm' | 'compact' | 'soft';

export type ThemePreview = {
  background: string;
  card: string;
  primary: string;
  muted: string;
  border: string;
  borderWidth: string;
  radius: string;
  shadow: string;
};

export const THEME_PRESETS: Record<ThemePreset, { label: string; preview: ThemePreview }> = {
  nature: { label: 'Default', preview: { background: '#f5f9ff', card: '#ffffff', primary: '#006bff', muted: '#e6f0ff', border: '#d7e6ff', borderWidth: '1px', radius: '.5rem', shadow: '0 2px 6px color-mix(in srgb, #006bff 10%, transparent)' } },
};

export const FONT_PRESETS: Record<FontPreset, { label: string }> = {
  'theme-default': { label: '主题默认' },
  'noto-sans': { label: '思源黑体' },
  'noto-serif': { label: '思源宋体' },
  'zcool-xiaowei': { label: '站酷小薇' },
};

export const PERSONALIZATION_DEFAULTS = {
  themePreset: 'nature' as ThemePreset,
  fontPreset: 'theme-default' as FontPreset,
  themeMode: 'system' as ThemeMode,
  contentLayout: 'full' as ContentLayout,
  topNavigationMode: 'scroll' as TopNavigationMode,
  sidebarStyle: 'embedded' as SidebarStyle,
  sidebarCollapseMode: 'icons' as SidebarCollapseMode,
  language: 'zh-CN' as AppLanguage,
};

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
  | 'background-remove'
  | 'product-retouch'
  | 'sources'
  | 'exports'
  | 'settings';

interface UIState {
  activePanel: PanelType;
  modalOpen: ModalType;
  contextMenu: ContextMenuState | null;
  theme: 'dark' | 'light';
  themePreset: ThemePreset;
  fontPreset: FontPreset;
  themeMode: ThemeMode;
  contentLayout: ContentLayout;
  topNavigationMode: TopNavigationMode;
  sidebarStyle: SidebarStyle;
  sidebarCollapseMode: SidebarCollapseMode;
  language: AppLanguage;
  interfaceStyle: InterfaceStyle;
  projectSidebarOpen: boolean;
  activeModule: ModuleType;
  workspaceMode: WorkspaceMode;
  rightPanelOpen: boolean;
  generationMode: GenerationMode;
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
  setThemePreset: (preset: ThemePreset) => void;
  setFontPreset: (preset: FontPreset) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setContentLayout: (layout: ContentLayout) => void;
  setTopNavigationMode: (mode: TopNavigationMode) => void;
  setSidebarStyle: (style: SidebarStyle) => void;
  setSidebarCollapseMode: (mode: SidebarCollapseMode) => void;
  setLanguage: (language: AppLanguage) => void;
  setInterfaceStyle: (style: InterfaceStyle) => void;
  resetPersonalization: () => void;
}

const resolveTheme = (mode: ThemeMode): 'dark' | 'light' => {
  if (mode !== 'system') return mode;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyVisualPreferences = (preset: ThemePreset, font: FontPreset, mode: ThemeMode, style: InterfaceStyle) => {
  const root = document.documentElement;
  const resolvedMode = resolveTheme(mode);
  root.dataset.theme = preset;
  root.dataset.font = font;
  root.dataset.themeMode = mode;
  root.dataset.interfaceStyle = style;
  root.classList.toggle('dark', resolvedMode === 'dark');
  return resolvedMode;
};

const legacyFontMap: Record<string, FontPreset> = {
  pingfang: 'theme-default', system: 'noto-sans', mono: 'theme-default',
};

export const useUIStore = create<UIState>()(persist((set) => ({
  activePanel: null,
  modalOpen: null,
  contextMenu: null,
  theme: resolveTheme(PERSONALIZATION_DEFAULTS.themeMode),
  ...PERSONALIZATION_DEFAULTS,
  interfaceStyle: 'calm',
  projectSidebarOpen: false,
  activeModule: 'image-gen',
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
    if (state.themePreset !== 'nature') return state;
    const themeMode = state.theme === 'dark' ? 'light' : 'dark';
    const theme = applyVisualPreferences(state.themePreset, state.fontPreset, themeMode, state.interfaceStyle);
    return { theme, themeMode };
  }),
  setThemePreset: () => set((state) => {
    const theme = applyVisualPreferences('nature', state.fontPreset, state.themeMode, state.interfaceStyle);
    return { themePreset: 'nature', theme };
  }),
  setFontPreset: (fontPreset) => set((state) => {
    const theme = applyVisualPreferences(state.themePreset, fontPreset, state.themeMode, state.interfaceStyle);
    return { fontPreset, theme };
  }),
  setThemeMode: (themeMode) => set((state) => {
    if (state.themePreset !== 'nature') return state;
    const theme = applyVisualPreferences(state.themePreset, state.fontPreset, themeMode, state.interfaceStyle);
    return { themeMode, theme };
  }),
  setContentLayout: (contentLayout) => set({ contentLayout }),
  setTopNavigationMode: (topNavigationMode) => set({ topNavigationMode }),
  setSidebarStyle: (sidebarStyle) => set({ sidebarStyle }),
  setSidebarCollapseMode: (sidebarCollapseMode) => set({ sidebarCollapseMode }),
  setLanguage: (language) => set({ language }),
  setInterfaceStyle: (interfaceStyle) => set((state) => {
    const theme = applyVisualPreferences(state.themePreset, state.fontPreset, state.themeMode, interfaceStyle);
    return { interfaceStyle, theme };
  }),
  resetPersonalization: () => set((state) => {
    const themePreset: ThemePreset = 'nature';
    const theme = applyVisualPreferences(
      themePreset,
      PERSONALIZATION_DEFAULTS.fontPreset,
      PERSONALIZATION_DEFAULTS.themeMode,
      state.interfaceStyle,
    );
    return { ...PERSONALIZATION_DEFAULTS, themePreset, theme };
  }),
}), {
  name: 'design-work-ui',
  version: 9,
  migrate: (persistedState) => {
    const previous = persistedState as Partial<UIState> & { themePreset?: string; fontPreset?: string } | undefined;
    const fontPreset = previous?.fontPreset && previous.fontPreset in FONT_PRESETS
      ? previous.fontPreset as FontPreset
      : legacyFontMap[previous?.fontPreset || ''] || PERSONALIZATION_DEFAULTS.fontPreset;
    const previousMode = previous?.themeMode ?? previous?.theme;
    const themeMode: ThemeMode = previousMode === 'light' || previousMode === 'dark' || previousMode === 'system'
      ? previousMode
      : PERSONALIZATION_DEFAULTS.themeMode;
    return {
      theme: resolveTheme(themeMode),
      themePreset: PERSONALIZATION_DEFAULTS.themePreset,
      fontPreset,
      themeMode,
      contentLayout: previous?.contentLayout ?? PERSONALIZATION_DEFAULTS.contentLayout,
      topNavigationMode: previous?.topNavigationMode ?? PERSONALIZATION_DEFAULTS.topNavigationMode,
      sidebarStyle: previous?.sidebarStyle ?? PERSONALIZATION_DEFAULTS.sidebarStyle,
      sidebarCollapseMode: previous?.sidebarCollapseMode ?? PERSONALIZATION_DEFAULTS.sidebarCollapseMode,
      language: previous?.language ?? PERSONALIZATION_DEFAULTS.language,
      interfaceStyle: previous?.interfaceStyle ?? 'calm',
      projectSidebarOpen: previous?.projectSidebarOpen ?? false,
      activeModule: 'image-gen' as ModuleType,
      workspaceMode: 'editor' as WorkspaceMode,
      rightPanelOpen: previous?.rightPanelOpen ?? true,
    };
  },
  partialize: (state) => ({
    theme: state.theme,
    themePreset: state.themePreset,
    fontPreset: state.fontPreset,
    themeMode: state.themeMode,
    contentLayout: state.contentLayout,
    topNavigationMode: state.topNavigationMode,
    sidebarStyle: state.sidebarStyle,
    sidebarCollapseMode: state.sidebarCollapseMode,
    language: state.language,
    interfaceStyle: state.interfaceStyle,
    projectSidebarOpen: state.projectSidebarOpen,
    rightPanelOpen: state.rightPanelOpen,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) {
      state.themePreset = 'nature';
      state.theme = applyVisualPreferences('nature', state.fontPreset, state.themeMode, state.interfaceStyle);
    }
  },
}));
