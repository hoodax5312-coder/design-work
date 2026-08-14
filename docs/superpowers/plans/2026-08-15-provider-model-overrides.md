# Provider Model Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace category-owned Provider connections with one Provider default connection whose models can independently override Base URL and API Key.

**Architecture:** Provider identity owns the common protocol, Base URL, API Key, model collection, and per-category default model IDs. A pure resolver produces the exact connection for one model by combining model overrides with Provider defaults; the service layer is the only request boundary that consumes the resolver. Category-specific activation remains in Zustand, while the settings page uses category tabs only to filter model cards.

**Tech Stack:** React 18, TypeScript, Zustand persist, Express 5, Node test runner through `tsx`, Tailwind CSS.

## Global Constraints

- Run Git, npm, type checking, Lint, tests, and builds only in `03-程序区/电脑运行文件/`.
- Preserve unrelated dirty-worktree changes and the existing image-generation layout edits.
- Provider defaults require name, protocol, Base URL, and API Key.
- Models may override only Base URL and API Key; protocol always inherits from the Provider.
- UI inheritance copy is `默认`; persisted data must never store `default` as a URL or Key.
- Language, image, and video retain independent active Provider IDs and default model IDs.
- Connection tests may call only model-list endpoints and must never call generation endpoints.
- API keys must not appear in errors, health records, task records, or logs.
- Existing v5 category connections must migrate atomically to version 6 and remain pending verification.
- Small UI iterations use `npm run typecheck:client`; module completion uses scoped ESLint; stage completion uses tests and `npm run build`.

---

### Task 1: Provider v6 domain model, resolver, and migration

**Files:**
- Modify: `src/types/provider.ts`
- Replace: `src/lib/providerConnections.ts`
- Modify: `server/providerConnections.test.ts`

**Interfaces:**
- Produces: `ProviderModel`, `ProviderConfig`, `ProviderStateSnapshot`.
- Produces: `resolveModelConnection(provider, category, modelId?)`, `getConfiguredModels(provider, category)`, `getSelectedModel(provider, category)`, `providerSupportsCategory(provider, category)`, `invalidateProviderModels(provider, field)`, `migrateProviderStateV6(value)`.

- [ ] **Step 1: Rewrite the domain tests to describe default inheritance and overrides**

```ts
test('resolves model URL and Key independently from provider defaults', () => {
  const provider = {
    id: 'mixed', name: 'Mixed', protocol: 'chat-completions' as const,
    baseUrl: 'https://default.example/v1', apiKey: 'default-key',
    models: [
      { id: 'default-model', categories: ['language' as const] },
      { id: 'override-model', categories: ['image' as const], baseUrlOverride: 'https://image.example/v1', apiKeyOverride: 'image-key' },
    ],
    selectedModels: { language: 'default-model', image: 'override-model' },
  };
  assert.deepEqual(resolveModelConnection(provider, 'language'), {
    category: 'language', protocol: 'chat-completions', baseUrl: 'https://default.example/v1', apiKey: 'default-key', model: 'default-model',
  });
  assert.equal(resolveModelConnection(provider, 'image')?.baseUrl, 'https://image.example/v1');
  assert.equal(resolveModelConnection(provider, 'image')?.apiKey, 'image-key');
});
```

Add a second test that migrates a v5 Provider with language defaults and a different image URL/Key. Assert that v6 chooses the dominant connection as common, writes image overrides, preserves `activeProviderIds`, and marks every model `pending`.

- [ ] **Step 2: Run the focused test and verify it fails against v5 types**

Run: `npx tsx --test server/providerConnections.test.ts`

Expected: FAIL because `resolveModelConnection` and `migrateProviderStateV6` do not exist.

- [ ] **Step 3: Replace category-owned connections with Provider defaults and model objects**

```ts
export interface ProviderModel {
  id: string;
  categories: ModelCategory[];
  baseUrlOverride?: string;
  apiKeyOverride?: string;
  verification?: ProviderVerification;
}

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  models: ProviderModel[];
  selectedModels: Partial<Record<ModelCategory, string>>;
  savedAt?: number;
}
```

- [ ] **Step 4: Implement category selectors and the single resolver**

```ts
export const resolveModelConnection = (
  provider: ProviderConfig | undefined,
  category: ModelCategory,
  modelId = getSelectedModel(provider, category),
) => {
  const model = provider?.models.find((item) => item.id === modelId && item.categories.includes(category));
  if (!provider || !model) return undefined;
  return {
    category,
    protocol: provider.protocol,
    baseUrl: model.baseUrlOverride?.trim() || provider.baseUrl.trim(),
    apiKey: model.apiKeyOverride?.trim() || provider.apiKey.trim(),
    model: model.id,
  };
};
```

`getConfiguredModels` returns model objects filtered by category. `getSelectedModel` accepts only a selected ID present in that category, then falls back to the first model. `providerSupportsCategory` checks the filtered collection.

Implement invalidation with this exact signature:

```ts
export const invalidateProviderModels = (
  provider: ProviderConfig,
  field: 'protocol' | 'baseUrl' | 'apiKey',
) => ({
  ...provider,
  models: provider.models.map((model) => {
    const affected = field === 'protocol'
      || (field === 'baseUrl' && !model.baseUrlOverride)
      || (field === 'apiKey' && !model.apiKeyOverride);
    return affected ? { ...model, verification: { status: 'pending' as const } } : model;
  }),
});
```

- [ ] **Step 5: Implement v5-to-v6 migration grouped by protocol**

For each v5 Provider, group category connections by `protocol`. Keep the group with the most model assignments under the original ID; create deterministic sibling IDs `${provider.id}-${protocol}` for other protocol groups. Inside each group, count model assignments per `baseUrl + apiKey` tuple, use the most frequent tuple as Provider defaults, merge matching model IDs and categories, and write overrides when a model tuple differs. Map every category active ID to the new Provider containing that category. Mark every migrated model `verification: { status: 'pending' }`.

For already-v6 input, normalize strings, categories, selected IDs, and verification values without changing valid overrides.

- [ ] **Step 6: Run focused domain tests**

Run: `npx tsx --test server/providerConnections.test.ts`

Expected: all domain and migration tests PASS. Full type checking runs after consumers migrate in Task 4.

### Task 2: Zustand v6 state and category-safe request service

**Files:**
- Modify: `src/stores/useProviderStore.ts`
- Modify: `src/services/providerService.ts`
- Modify: `server/providerService.test.ts`

**Interfaces:**
- Consumes: `migrateProviderStateV6`, `resolveModelConnection`.
- Produces store actions: `setActiveProvider(category, providerId)`, `setSelectedModel(providerId, category, modelId)`, `upsertProvider(provider)`, `replaceProviders(snapshot)`, `removeProvider(id)`.
- Produces service functions with optional explicit model IDs: `testProviderModel(provider, category, modelId)`, `generateProviderText(provider, prompt, modelId?)`, `generateProviderImage(provider, input, modelId?)`, `generateProviderVideo(provider, input, modelId?)`.

- [ ] **Step 1: Extend service tests for inherited and overridden payloads**

Create one Provider containing a default language model and an overridden image model. Capture `fetch` request bodies and assert language sends the common URL/Key while image sends only its override URL/Key. Assert neither payload contains the other Key.

- [ ] **Step 2: Run the service test and verify v5 payload logic fails**

Run: `npx tsx --test server/providerService.test.ts`

Expected: FAIL until the service uses `resolveModelConnection`.

- [ ] **Step 3: Upgrade the store to persistence version 6**

Set `version: 6` and `migrate: migrateProviderStateV6`. `setSelectedModel` updates `selectedModels[category]` only if the model supports the category. `setActiveProvider` keeps category-specific activation. Removing a Provider removes only matching active IDs.

- [ ] **Step 4: Route every service request through the resolver**

```ts
const configPayload = (provider: ProviderConfig, category: ModelCategory, modelId?: string) => {
  const config = resolveModelConnection(provider, category, modelId);
  if (!config?.baseUrl || !config.apiKey || !config.model) {
    throw new Error(`当前厂商未完成${categoryLabels[category]}模型连接配置`);
  }
  return config;
};
```

`testProviderModel` posts to `/api/provider/test`; generation functions pass their category and optional explicit model ID.

- [ ] **Step 5: Run Provider unit tests**

Run: `npx tsx --test server/providerConnections.test.ts server/providerService.test.ts server/providerGateway.test.ts`

Expected: all Provider tests PASS and captured verification URLs contain only `/models`.

### Task 3: Common Provider editor and always-visible model cards

**Files:**
- Create: `src/components/modals/settings/ProviderModelCard.tsx`
- Modify: `src/components/modals/settings/ApiSettings.tsx`
- Delete: `src/components/modals/settings/ProviderConnectionEditor.tsx`

**Interfaces:**
- Consumes: `ProviderModel`, `resolveModelConnection`, `testProviderModel`, `invalidateProviderModels`.
- Produces: `ProviderModelCard({ provider, model, category, isDefault, testing, onChange, onRemove, onSetDefault, onTest })`.

- [ ] **Step 1: Build the common Provider section**

Place name, upstream format, common Base URL, and common API Key above the tabs. Add a no-cost common connection test that uses one available model and reports model-list access without creating models. Changing protocol invalidates all models; changing common URL or Key invalidates only models inheriting that field.

- [ ] **Step 2: Convert category tabs into filters with counts**

Render `文本 N`, `生图 N`, and `视频 N`. Switching tabs changes only the filtered model collection. The add-model form creates or updates one `ProviderModel` with the active category and marks it pending.

- [ ] **Step 3: Implement always-visible URL and Key rows in each model card**

Each row has a compact `默认 / 自定义` selector and its value field. In `默认`, show the resolved common URL or masked common Key in a disabled field. In `自定义`, edit `baseUrlOverride` or `apiKeyOverride`. Switching back to `默认` removes the override property. Never place a masked Key string into persisted state.

- [ ] **Step 4: Add per-model validation, testing, defaults, and status**

Reject save when Provider defaults are incomplete, a model ID/category is missing, or a field set to custom is empty. Per-model test calls `testProviderModel(provider, category, model.id)`, updates only that model verification, and shows sanitized errors inside its card. Default selection updates `selectedModels[category]`.

- [ ] **Step 5: Upgrade import/export to version 3**

Export `{ format, version: 3, activeProviderIds, providers }`. Import all older shapes through `migrateProviderStateV6`, validate Provider defaults and model arrays, and mark imported models pending.

- [ ] **Step 6: Run settings-file ESLint**

Run: `npx eslint src/components/modals/settings/ApiSettings.tsx src/components/modals/settings/ProviderModelCard.tsx --max-warnings 0`

Expected: settings files have no v5 `connections` references and pass ESLint. Full TypeScript validation runs after consumers migrate in Task 4.

### Task 4: Migrate text, image, video, and canvas consumers

**Files:**
- Modify: `src/components/canvas/Canvas.tsx`
- Modify: `src/components/nodes/TextNode.tsx`
- Modify: `src/components/canvas/CanvasPromptOverlay.tsx`
- Modify: `src/components/image-gen/ImageGeneration.tsx`
- Modify: `src/components/video-gen/VideoGeneration.tsx`

**Interfaces:**
- Consumes: `getConfiguredModels` returning `ProviderModel[]`, category-specific active IDs, and service functions accepting optional model IDs.

- [ ] **Step 1: Update model option construction**

Replace string model assumptions with `model.id`. Resolve explicit selections only when the selected Provider model supports the requested category. Keep category-specific active Provider fallback.

- [ ] **Step 2: Pass explicit model IDs to service functions**

Text nodes and canvas overlays call their service with the selected model ID instead of cloning Provider connection objects. Image and video generation use the store-selected category model ID.

- [ ] **Step 3: Verify there is no v5 connection access in consumers**

Run:

```bash
rg -n "\.connections\b|getProviderConnection\b|ProviderConnection\b" \
  src/components/canvas src/components/nodes/TextNode.tsx \
  src/components/image-gen src/components/video-gen src/services
```

Expected: no consumer or service reads the removed v5 connection structure; only domain migration tests may reference legacy `connections` fixtures.

- [ ] **Step 4: Run both type checks**

Run: `npm run typecheck`

Expected: client and server type checks PASS.

### Task 5: Verification, browser QA, and task record

**Files:**
- Modify only files required by failures attributable to this feature.
- Create: `01-项目管理/06-任务与迭代/已完成/任务-2026-08-15-厂商通用配置与模型覆盖.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified v6 configuration workflow and project task record.

- [ ] **Step 1: Run focused Provider tests**

Run: `npx tsx --test server/providerConnections.test.ts server/providerService.test.ts server/providerGateway.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 2: Run type checks and scoped ESLint**

Run `npm run typecheck`, then run ESLint only across Provider, settings, canvas, image, and video files changed by this plan with `--max-warnings 0`.

Expected: both checks PASS. Keep the existing unrelated `QuickNotes.tsx` global Lint failure out of this scoped command and report it separately.

- [ ] **Step 3: Run the repository test suite and build**

Run: `npm test` and `npm run build` separately.

Expected: build PASS. Record the known unrelated database migration assertion if the suite still expects `[1,2,3,4]` instead of `[1,2,3,4,5]`.

- [ ] **Step 4: Perform no-cost browser verification**

Verify in the local app:

1. Provider common fields stay unchanged while switching model category tabs.
2. Every model card always shows URL and Key rows.
3. Default rows show `默认`, resolved URL, and a masked Key.
4. Custom URL or Key affects only the edited model and switching back clears the override.
5. Language, image, and video retain independent active Providers.
6. Migrated models are visible with correct category counts and pending status.
7. No real generation request is made and the console has no new errors.

- [ ] **Step 5: Write the completed task record**

Use `01-项目管理/_模板/任务.md`. Include scope, validation results, known unrelated baseline failures, and links to the design and plan documents. Do not include API keys or error fragments containing keys.
