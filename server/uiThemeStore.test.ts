import assert from 'node:assert/strict';
import test from 'node:test';
import { PERSONALIZATION_DEFAULTS, useUIStore } from '../src/stores/useUIStore';

const classNames = new Set<string>();

Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    documentElement: {
      dataset: {} as Record<string, string>,
      classList: {
        toggle: (name: string, enabled: boolean) => {
          if (enabled) classNames.add(name);
          else classNames.delete(name);
        },
      },
    },
  },
});

test('fresh preferences default to dark mode', () => {
  assert.equal(PERSONALIZATION_DEFAULTS.themeMode, 'dark');
  assert.equal(useUIStore.getInitialState().themeMode, 'dark');
  assert.equal(useUIStore.getInitialState().theme, 'dark');
});

test('resetting personalization restores dark mode from a fixed light preset', () => {
  useUIStore.setState({ themePreset: 'brutalist', themeMode: 'light', theme: 'light' });
  useUIStore.getState().resetPersonalization();
  assert.equal(useUIStore.getState().themePreset, 'nature');
  assert.equal(useUIStore.getState().themeMode, 'dark');
  assert.equal(useUIStore.getState().theme, 'dark');
  assert.equal(classNames.has('dark'), true);
});

test('selecting Neo-brutalism forces its fixed light appearance', () => {
  useUIStore.setState({ themePreset: 'nature', themeMode: 'dark', theme: 'dark' });

  useUIStore.getState().setThemePreset('brutalist');

  const state = useUIStore.getState();
  assert.equal(state.themePreset, 'brutalist');
  assert.equal(state.themeMode, 'light');
  assert.equal(state.theme, 'light');
  assert.equal(classNames.has('dark'), false);
});

test('selecting Claude forces its fixed light appearance', () => {
  useUIStore.setState({ themePreset: 'nature', themeMode: 'dark', theme: 'dark' });

  useUIStore.getState().setThemePreset('claude');

  const state = useUIStore.getState();
  assert.equal(state.themePreset, 'claude');
  assert.equal(state.themeMode, 'light');
  assert.equal(state.theme, 'light');
});

test('fixed theme presets ignore standalone mode changes', () => {
  useUIStore.setState({ themePreset: 'brutalist', themeMode: 'light', theme: 'light' });

  useUIStore.getState().setThemeMode('dark');

  const state = useUIStore.getState();
  assert.equal(state.themePreset, 'brutalist');
  assert.equal(state.themeMode, 'light');
  assert.equal(state.theme, 'light');
});

test('navigation position defaults to left and supports all three positions', () => {
  useUIStore.setState({ navigationPosition: 'left', projectSidebarOpen: false });
  const initialState = useUIStore.getState();

  assert.equal(initialState.navigationPosition, 'left');
  assert.equal(typeof initialState.setNavigationPosition, 'function');

  initialState.setNavigationPosition('top');
  assert.equal(useUIStore.getState().navigationPosition, 'top');

  initialState.setNavigationPosition('right');
  assert.equal(useUIStore.getState().navigationPosition, 'right');
  assert.equal(useUIStore.getState().projectSidebarOpen, true);

  useUIStore.setState({ projectSidebarOpen: false });
  initialState.setNavigationPosition('left');
  assert.equal(useUIStore.getState().navigationPosition, 'left');
  assert.equal(useUIStore.getState().projectSidebarOpen, true);
});

test('top navigation preserves its collapsed state and supports complete hiding', () => {
  useUIStore.setState({ projectSidebarOpen: true, sidebarCollapseMode: 'icons' });

  useUIStore.getState().setNavigationPosition('top');
  useUIStore.getState().setSidebarCollapseMode('hidden');

  assert.equal(useUIStore.getState().navigationPosition, 'top');
  assert.equal(useUIStore.getState().sidebarCollapseMode, 'hidden');
  assert.equal(useUIStore.getState().projectSidebarOpen, false);
});
