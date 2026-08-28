# Navigation Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted left/top/right main-navigation position setting and soften all theme-card label overlays with a transparent-to-semitransparent gradient.

**Architecture:** Keep one `ProjectSidebar` component and make it orientation-aware from Zustand state. `AppShell` changes its flex direction and workspace spacing, while the sidebar component changes dimensions, navigation flow, borders, and collapse handle placement. The settings page remains the only configuration surface.

**Tech Stack:** React, TypeScript, Zustand persist middleware, Tailwind CSS, Node test runner.

## Global Constraints

- Default navigation position is `left`.
- Top navigation always shows icon + text and has no expand/collapse handle; the collapse preference remains available for left and right navigation.
- Left, top, and right positions continue to support embedded, standard, and floating styles.
- Do not duplicate the navigation information architecture or create a second top-navigation component.
- Theme-card overlays fade from fully transparent at the top to 50% black at the bottom.

---

### Task 1: Persist navigation position

**Files:**
- Modify: `src/stores/useUIStore.ts`
- Modify: `server/uiThemeStore.test.ts`

**Interfaces:**
- Produces: `NavigationPosition = 'left' | 'top' | 'right'`
- Produces: `navigationPosition: NavigationPosition`
- Produces: `setNavigationPosition(position: NavigationPosition): void`

- [ ] **Step 1: Write failing state tests**

Add assertions that the default is `left`, all three valid positions can be selected, and reset returns to `left`.

- [ ] **Step 2: Run the targeted test and confirm RED**

Run: `npx tsx --test server/uiThemeStore.test.ts`

Expected: FAIL because `navigationPosition` and `setNavigationPosition` do not exist.

- [ ] **Step 3: Add the state and migration**

Add the union type, default, store field and setter. Include the field in `partialize`, normalize persisted values in `migrate`, and bump the persistence version.

- [ ] **Step 4: Run the targeted test and confirm GREEN**

Run: `npx tsx --test server/uiThemeStore.test.ts`

Expected: all theme and navigation-position tests pass.

### Task 2: Make the shell orientation-aware

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/ProjectSidebar.tsx`

**Interfaces:**
- Consumes: `navigationPosition`, `projectSidebarOpen`, `sidebarCollapseMode`, and `sidebarStyle`
- Produces: `data-navigation-position` on the root shell

- [ ] **Step 1: Change shell direction and ordering**

Use `flex-col` for top and `flex-row` otherwise. Render the same sidebar before the workspace for left/top and after it for right. Rotate embedded/floating workspace margins to preserve the outer gap on the side opposite the navigation.

- [ ] **Step 2: Adapt sidebar dimensions and navigation flow**

For top, always use `h-16 w-full`, horizontal navigation, and compact icon-plus-label items. For left/right, keep the existing 200px/64px/0 width behavior and vertical navigation.

- [ ] **Step 3: Adapt borders, floating margins, and collapse handle**

Use bottom border for top standard navigation and left border for right standard navigation. Place the collapse handle only on the outer edge of left and right navigation; top navigation has no handle.

### Task 3: Add the setting and overlay gradient

**Files:**
- Modify: `src/components/modals/settings/GeneralSettings.tsx`

**Interfaces:**
- Consumes: `NavigationPosition`, `navigationPosition`, `setNavigationPosition`

- [ ] **Step 1: Add the setting row**

Insert “导航栏位置” before “导航栏样式” with three options: `left`/左侧, `top`/顶部, and `right`/右侧.

- [ ] **Step 2: Replace the solid overlay**

Replace `bg-black/65 backdrop-blur-md` with a vertical gradient that starts transparent and ends at `rgba(0,0,0,0.5)`, keeping white text and the selection check.

### Task 4: Document and verify

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `../../01-项目管理/工作台.md`
- Modify: `../../01-项目管理/06-任务与迭代/任务索引.md`
- Create: `../../01-项目管理/06-任务与迭代/任务-2026-08-28-导航栏位置设置.md`

- [ ] **Step 1: Record the accepted behavior and evidence**

Document the default, three positions, top collapse semantics, fixed single component, and gradient overlay.

- [ ] **Step 2: Run full verification**

Run `npm run typecheck:client`, `npm run lint`, `npm test`, and `git diff --check`.

Expected: all commands exit with code 0.

- [ ] **Step 3: Confirm the local server**

Run: `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/`

Expected: `200`.
