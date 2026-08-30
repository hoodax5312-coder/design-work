import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PanelType = 'assets' | 'workflow' | 'history' | 'tools' | null;
export type ModalType = 'workflow' | null;
export type WorkspaceMode = 'editor' | 'manager';
export type GenerationMode = 'image' | 'video';
export type ThemePreset = 'nature' | 'brutalist' | 'claude';
export type FontPreset = 'theme-default' | 'noto-sans' | 'noto-serif' | 'zcool-xiaowei';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ContentLayout = 'centered' | 'full';
export type TopNavigationMode = 'scroll' | 'fixed';
export type SidebarStyle = 'embedded' | 'standard' | 'floating';
export type SidebarCollapseMode = 'icons' | 'hidden';
export type NavigationPosition = 'left' | 'top' | 'right';
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
  nature: { label: 'Default', preview: { background: 'lab(98.84% .0000298023 -.0000119209)', card: 'lab(100% 0 0)', primary: 'lab(0% 0 0)', muted: 'lab(96.52% -.0000298023 .0000119209)', border: 'lab(90.72% .0000298023 -.0000119209)', borderWidth: '1px', radius: '.5rem', shadow: '0 1px 2px color-mix(in srgb, lab(0% 0 0) 6%, transparent)' } },
  brutalist: { label: 'Neo-brutalism', preview: { background: '#FFFDF5', card: '#FFFFFF', primary: '#FACC15', muted: '#C4B5FD', border: '#000000', borderWidth: '3px', radius: '0', shadow: '8px 8px 0 #000000' } },
  claude: { label: 'Claude', preview: { background: 'lab(97.9228% -.175089 2.05069)', card: 'lab(100% 0 0)', primary: 'lab(54.5081% 39.1499 38.3555)', muted: 'lab(92.4332% -.00917912 5.86995)', border: 'lab(86.6716% -.311345 2.61091)', borderWidth: '1px', radius: '.5rem', shadow: '0 2px 8px color-mix(in srgb, lab(54.5081% 39.1499 38.3555) 8%, transparent)' } },
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
  navigationPosition: 'left' as NavigationPosition,
  language: 'zh-CN' as AppLanguage,
};

const FIXED_THEME_MODES: Partial<Record<ThemePreset, ThemeMode>> = {
  brutalist: 'light',
  claude: 'light',
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
  | 'cases'
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
  navigationPosition: NavigationPosition;
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
  setNavigationPosition: (position: NavigationPosition) => void;
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
    if (FIXED_THEME_MODES[state.themePreset]) return state;
    const themeMode = state.theme === 'dark' ? 'light' : 'dark';
    const theme = applyVisualPreferences(state.themePreset, state.fontPreset, themeMode, state.interfaceStyle);
    return { theme, themeMode };
  }),
  setThemePreset: (themePreset) => set((state) => {
    const themeMode = FIXED_THEME_MODES[themePreset] ?? state.themeMode;
    const theme = applyVisualPreferences(themePreset, state.fontPreset, themeMode, state.interfaceStyle);
    return { themePreset, themeMode, theme };
  }),
  setFontPreset: (fontPreset) => set((state) => {
    const theme = applyVisualPreferences(state.themePreset, fontPreset, state.themeMode, state.interfaceStyle);
    return { fontPreset, theme };
  }),
  setThemeMode: (themeMode) => set((state) => {
    if (FIXED_THEME_MODES[state.themePreset]) return state;
    const theme = applyVisualPreferences(state.themePreset, state.fontPreset, themeMode, state.interfaceStyle);
    return { themeMode, theme };
  }),
  setContentLayout: (contentLayout) => set({ contentLayout }),
  setTopNavigationMode: (topNavigationMode) => set({ topNavigationMode }),
  setSidebarStyle: (sidebarStyle) => set({ sidebarStyle }),
  setSidebarCollapseMode: (sidebarCollapseMode) => set({
    sidebarCollapseMode,
    projectSidebarOpen: false,
  }),
  setNavigationPosition: (navigationPosition) => set({
    navigationPosition,
    ...(navigationPosition === 'top' ? {} : { projectSidebarOpen: true }),
  }),
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
  version: 11,
  migrate: (persistedState) => {
    const previous = persistedState as Partial<UIState> & { themePreset?: string; fontPreset?: string } | undefined;
    const fontPreset = previous?.fontPreset && previous.fontPreset in FONT_PRESETS
      ? previous.fontPreset as FontPreset
      : legacyFontMap[previous?.fontPreset || ''] || PERSONALIZATION_DEFAULTS.fontPreset;
    const themePreset: ThemePreset = previous?.themePreset === 'brutalist' || previous?.themePreset === 'claude'
      ? previous.themePreset
      : PERSONALIZATION_DEFAULTS.themePreset;
    const previousMode = previous?.themeMode ?? previous?.theme;
    const storedThemeMode: ThemeMode = previousMode === 'light' || previousMode === 'dark' || previousMode === 'system'
      ? previousMode
      : PERSONALIZATION_DEFAULTS.themeMode;
    const themeMode = FIXED_THEME_MODES[themePreset] ?? storedThemeMode;
    const navigationPosition: NavigationPosition = previous?.navigationPosition === 'top' || previous?.navigationPosition === 'right'
      ? previous.navigationPosition
      : PERSONALIZATION_DEFAULTS.navigationPosition;
    return {
      theme: resolveTheme(themeMode),
      themePreset,
      fontPreset,
      themeMode,
      contentLayout: previous?.contentLayout ?? PERSONALIZATION_DEFAULTS.contentLayout,
      topNavigationMode: previous?.topNavigationMode ?? PERSONALIZATION_DEFAULTS.topNavigationMode,
      sidebarStyle: previous?.sidebarStyle ?? PERSONALIZATION_DEFAULTS.sidebarStyle,
      sidebarCollapseMode: previous?.sidebarCollapseMode ?? PERSONALIZATION_DEFAULTS.sidebarCollapseMode,
      navigationPosition,
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
    navigationPosition: state.navigationPosition,
    language: state.language,
    interfaceStyle: state.interfaceStyle,
    projectSidebarOpen: state.projectSidebarOpen,
    rightPanelOpen: state.rightPanelOpen,
  }),
  onRehydrateStorage: () => (state) => {
    if (state) {
      const themePreset = state.themePreset in THEME_PRESETS ? state.themePreset : PERSONALIZATION_DEFAULTS.themePreset;
      const themeMode = FIXED_THEME_MODES[themePreset] ?? state.themeMode;
      state.themePreset = themePreset;
      state.themeMode = themeMode;
      state.theme = applyVisualPreferences(themePreset, state.fontPreset, themeMode, state.interfaceStyle);
    }
  },
}));
