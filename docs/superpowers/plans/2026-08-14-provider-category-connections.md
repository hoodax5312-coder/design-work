# Provider Category Connections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single shared Provider connection with independent language, image, and video connections, category-specific activation, no-cost connection tests, and a top-tab settings editor.

**Architecture:** Provider identity remains shared, while each model category owns a complete optional `ProviderConnection`. Pure helpers handle category lookup and v4-to-v5 migration; the Zustand store owns category-specific activation; the service layer is the only place that converts a category connection into a gateway request. The gateway verifies model-list access without generation calls and sanitizes upstream errors before returning them.

**Tech Stack:** React 18, TypeScript, Zustand persist, Express 5, Node test runner through `tsx`, Tailwind CSS.

## Global Constraints

- Run Git, npm, type checking, lint, tests, and builds only in `03-程序区/电脑运行文件/`.
- Preserve unrelated dirty-worktree changes and never revert user edits.
- Text, image, and video connections must not inherit from or fall back to another category.
- Connection tests may call only model-list endpoints; they must not call chat, image generation, or video generation.
- A provider may configure any subset of language, image, and video.
- Unverified connections may be activated only after a one-time explicit warning.
- API keys must not appear in UI errors, server responses, health records, task records, or logs.
- Small UI iterations use `npm run typecheck:client`; after the module is complete run `npm run lint`; run tests and build only at the stage boundary.

---

### Task 1: Provider domain types and v4-to-v5 migration

**Files:**
- Create: `src/types/provider.ts`
- Create: `src/lib/providerConnections.ts`
- Create: `server/providerConnections.test.ts`
- Modify: `src/stores/useProviderStore.ts`

**Interfaces:**
- Produces: `ProviderConnection`, `ProviderConfig`, `ProviderStateSnapshot`, `ActiveProviderIds`.
- Produces: `getProviderConnection(provider, category)`, `getSelectedModel(provider, category)`, `providerSupportsCategory(provider, category)`, `migrateProviderStateV5(value)`.
- Produces store actions: `setActiveProvider(category, providerId)`, `setConnection(providerId, category, connection)`, `setSelectedModel(providerId, category, model)`.

- [ ] **Step 1: Write failing migration and selector tests**

```ts
// server/providerConnections.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getProviderConnection,
  migrateProviderStateV5,
} from '../src/lib/providerConnections';

test('migrates a v4 provider into category connections and marks them pending', () => {
  const migrated = migrateProviderStateV5({
    providers: [{
      id: 'legacy',
      name: 'Legacy',
      protocol: 'chat-completions',
      baseUrl: 'https://legacy.example/v1',
      apiKey: 'secret',
      model: 'text-model',
      models: [],
      enabled: true,
      configuredModels: [
        { id: 'text-model', categories: ['language'] },
        { id: 'image-model', categories: ['image'] },
      ],
      modelSelections: { language: 'text-model', image: 'image-model' },
    }],
    activeProviderId: 'legacy',
  });

  assert.deepEqual(migrated.activeProviderIds, {
    language: 'legacy',
    image: 'legacy',
  });
  assert.equal(migrated.providers[0].connections.language?.selectedModel, 'text-model');
  assert.equal(migrated.providers[0].connections.image?.selectedModel, 'image-model');
  assert.equal(migrated.providers[0].connections.video, undefined);
  assert.equal(migrated.providers[0].connections.image?.verification?.status, 'pending');
});

test('never falls back across categories', () => {
  const provider = {
    id: 'image-only',
    name: 'Image only',
    connections: {
      image: {
        protocol: 'chat-completions' as const,
        baseUrl: 'https://image.example/v1',
        apiKey: 'secret',
        models: ['image-model'],
        selectedModel: 'image-model',
      },
    },
  };
  assert.equal(getProviderConnection(provider, 'language'), undefined);
  assert.equal(getProviderConnection(provider, 'image')?.selectedModel, 'image-model');
});
```

- [ ] **Step 2: Run the test and verify the new module is missing**

Run: `npx tsx --test server/providerConnections.test.ts`

Expected: FAIL with `Cannot find module '../src/lib/providerConnections'`.

- [ ] **Step 3: Add the category-owned provider types**

```ts
// src/types/provider.ts
export type ProviderProtocol = 'responses' | 'chat-completions' | 'anthropic-messages';
export type ModelCategory = 'language' | 'image' | 'video';
export type VerificationStatus = 'pending' | 'healthy' | 'unhealthy' | 'unverified';

export interface ProviderConnection {
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  models: string[];
  selectedModel: string;
  verification?: {
    status: VerificationStatus;
    checkedAt?: number;
    latency?: number;
    error?: string;
  };
}

export interface ProviderConfig {
  id: string;
  name: string;
  connections: Partial<Record<ModelCategory, ProviderConnection>>;
  savedAt?: number;
}

export type ActiveProviderIds = Partial<Record<ModelCategory, string>>;
export interface ProviderStateSnapshot {
  providers: ProviderConfig[];
  activeProviderIds: ActiveProviderIds;
}
```

- [ ] **Step 4: Implement pure selectors and atomic migration**

```ts
// src/lib/providerConnections.ts
import type {
  ActiveProviderIds,
  ModelCategory,
  ProviderConfig,
  ProviderConnection,
  ProviderProtocol,
  ProviderStateSnapshot,
} from '../types/provider';

const CATEGORIES: ModelCategory[] = ['language', 'image', 'video'];

export const getProviderConnection = (
  provider: ProviderConfig | undefined,
  category: ModelCategory,
) => provider?.connections[category];

export const getSelectedModel = (
  provider: ProviderConfig | undefined,
  category: ModelCategory,
) => getProviderConnection(provider, category)?.selectedModel || '';

export const providerSupportsCategory = (
  provider: ProviderConfig,
  category: ModelCategory,
) => Boolean(getProviderConnection(provider, category));

export const migrateProviderStateV5 = (value: unknown): ProviderStateSnapshot => {
  const legacy = value as any;
  if (legacy?.activeProviderIds && legacy?.providers?.every((item: any) => item.connections)) {
    return legacy as ProviderStateSnapshot;
  }
  const providers: ProviderConfig[] = (legacy?.providers || []).map((provider: any) => {
    const connections: ProviderConfig['connections'] = {};
    for (const category of CATEGORIES) {
      const models = (provider.configuredModels || [])
        .filter((model: any) => (model.categories || [model.category || 'language']).includes(category))
        .map((model: any) => String(model.id));
      if (!models.length) continue;
      connections[category] = {
        protocol: provider.protocol as ProviderProtocol,
        baseUrl: provider.baseUrl || '',
        apiKey: provider.apiKey || '',
        models,
        selectedModel: provider.modelSelections?.[category]
          || (category === 'language' ? provider.model : '')
          || models[0],
        verification: { status: 'pending' },
      } satisfies ProviderConnection;
    }
    return { id: provider.id, name: provider.name, savedAt: provider.savedAt, connections };
  });
  const activeProviderIds: ActiveProviderIds = {};
  for (const category of CATEGORIES) {
    if (providers.find((provider) => provider.id === legacy?.activeProviderId)?.connections[category]) {
      activeProviderIds[category] = legacy.activeProviderId;
    }
  }
  return { providers, activeProviderIds };
};
```

- [ ] **Step 5: Replace the Zustand state with category-specific actions and version 5 migration**

Implement the store with `providers`, `activeProviderIds`, `upsertProvider`, `setActiveProvider(category, id)`, `setConnection`, `setSelectedModel`, and `removeProvider`. Configure persist with `version: 5` and `migrate: migrateProviderStateV5`. When removing a provider, filter only the matching IDs from `activeProviderIds`.

- [ ] **Step 6: Run migration tests and client type checking**

Run: `npx tsx --test server/providerConnections.test.ts && npm run typecheck:client`

Expected: both commands PASS.

- [ ] **Step 7: Commit the domain migration**

```bash
git add src/types/provider.ts src/lib/providerConnections.ts src/stores/useProviderStore.ts server/providerConnections.test.ts
git commit -m "refactor: split provider connections by model type"
```

### Task 2: No-cost gateway verification and key-safe errors

**Files:**
- Modify: `server/providerGateway.ts`
- Modify: `server/providerGateway.test.ts`

**Interfaces:**
- Consumes: `ModelCategory`, `ProviderProtocol` from `src/types/provider.ts`.
- Produces: `testProviderModels(config)`, `sanitizeProviderError(message, apiKey)`, and `/api/provider/test` response without chat verification.

- [ ] **Step 1: Add failing tests for no-cost verification and API-key redaction**

```ts
import {
  sanitizeProviderError,
  testProviderModels,
} from './providerGateway';

test('redacts a provider key echoed by the upstream error', () => {
  const key = 'secret-provider-key-123456';
  const message = `Incorrect API key provided: ${key}`;
  const sanitized = sanitizeProviderError(message, key);
  assert.equal(sanitized.includes(key), false);
  assert.equal(sanitized.includes('secret-provider'), false);
});

test('model verification only calls the models endpoint', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ data: [{ id: 'image-model' }] });
  };
  try {
    const result = await testProviderModels({ ...config, model: 'image-model', category: 'image' });
    assert.deepEqual(result, ['image-model']);
    assert.deepEqual(calls, ['https://example.com/models']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

- [ ] **Step 2: Run gateway tests and verify they fail**

Run: `npx tsx --test server/providerGateway.test.ts`

Expected: FAIL because the two exports do not exist.

- [ ] **Step 3: Add category context and redaction**

Extend `ProviderRequestConfig` with `category: ModelCategory`. Add `sanitizeProviderError(message, apiKey)` that replaces the exact key, Bearer tokens, `api-key` assignments, and common long token patterns with `[REDACTED]`. Call it before every error is returned to Express.

- [ ] **Step 4: Replace test-time chat generation with model-list verification only**

Rename the shared model test to `testProviderModels`. For OpenAI-compatible protocols call `${baseUrl}/models` with existing compatibility headers. For Anthropic call `${baseUrl}/models` with `x-api-key` and `anthropic-version`. `/test` returns `{ ok, latency, models, normalizedBaseUrl }`; remove `chatVerified` and never call `/responses`, `/chat/completions`, `/messages`, `/images/generations`, or `/video/generations`.

- [ ] **Step 5: Add safe error context**

Return errors in this shape without request headers or key fragments:

```ts
const label = { language: '文本', image: '生图', video: '视频' }[config.category];
const host = new URL(config.baseUrl).host;
error.message = `${label}连接 · ${host} · ${status}：${sanitizeProviderError(message, config.apiKey)}`;
```

- [ ] **Step 6: Run gateway tests**

Run: `npx tsx --test server/providerGateway.test.ts`

Expected: all gateway tests PASS and captured URLs contain only `/models` for verification.

- [ ] **Step 7: Commit the gateway changes**

```bash
git add server/providerGateway.ts server/providerGateway.test.ts
git commit -m "fix: verify provider connections without generation"
```

### Task 3: Category-aware client service

**Files:**
- Modify: `src/services/providerService.ts`
- Create: `server/providerService.test.ts`

**Interfaces:**
- Consumes: `ProviderConfig`, `ModelCategory`, `getProviderConnection`.
- Produces: `testProvider(provider: ProviderConfig, category: ModelCategory)`, `generateProviderText(provider: ProviderConfig, prompt: string)`, `generateProviderImage(provider: ProviderConfig, input: { prompt: string; size: string; quality: string })`, and `generateProviderVideo(provider: ProviderConfig, input: { prompt: string; resolution?: string })` with category-safe payloads.

- [ ] **Step 1: Write failing request-payload tests**

```ts
// server/providerService.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { generateProviderImage } from '../src/services/providerService';

test('image generation sends only the image connection', async () => {
  const originalFetch = globalThis.fetch;
  let body: any;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ url: 'https://example.com/image.png' });
  };
  try {
    await generateProviderImage({
      id: 'mixed',
      name: 'Mixed',
      connections: {
        language: { protocol: 'responses', baseUrl: 'https://text.example/v1', apiKey: 'text-key', models: ['text'], selectedModel: 'text' },
        image: { protocol: 'chat-completions', baseUrl: 'https://image.example/v1', apiKey: 'image-key', models: ['image'], selectedModel: 'image' },
      },
    }, { prompt: 'test', size: '1024x1024', quality: 'high' });
    assert.equal(body.config.category, 'image');
    assert.equal(body.config.baseUrl, 'https://image.example/v1');
    assert.equal(body.config.apiKey, 'image-key');
    assert.equal(JSON.stringify(body).includes('text-key'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
```

- [ ] **Step 2: Run the service test and verify it fails**

Run: `npx tsx --test server/providerService.test.ts`

Expected: FAIL because the old service reads shared provider fields.

- [ ] **Step 3: Implement a single category payload resolver**

```ts
const configPayload = (provider: ProviderConfig, category: ModelCategory) => {
  const connection = getProviderConnection(provider, category);
  if (!connection?.baseUrl || !connection.apiKey || !connection.selectedModel) {
    throw new Error(`当前厂商未完成${categoryLabel[category]}连接配置`);
  }
  return { category, ...connection, model: connection.selectedModel };
};
```

Use `language` in `generateProviderText`, `image` in `generateProviderImage`, `video` in `generateProviderVideo`, and accept an explicit category in `testProvider`.

- [ ] **Step 4: Run service tests and both type checks**

Run: `npx tsx --test server/providerService.test.ts && npm run typecheck`

Expected: service test and client/server type checks PASS.

- [ ] **Step 5: Commit the service changes**

```bash
git add src/services/providerService.ts server/providerService.test.ts
git commit -m "refactor: route provider requests by model type"
```

### Task 4: Top-tab Provider settings editor and import/export v2

**Files:**
- Create: `src/components/modals/settings/ProviderConnectionEditor.tsx`
- Modify: `src/components/modals/settings/ApiSettings.tsx`

**Interfaces:**
- Consumes: category-owned Provider types and `testProvider(provider, category)`.
- Produces: `ProviderConnectionEditor({ category, connection, onChange, onTest })`.

- [ ] **Step 1: Extract a focused connection editor**

Create `ProviderConnectionEditor` with fields for upstream format, Base URL, API Key, model IDs, and default model. Any field mutation sets `verification: { status: 'pending' }`. An all-empty editor reports `undefined` to the parent so partial providers remain valid.

- [ ] **Step 2: Add top category tabs to the Provider draft form**

Use a local `activeCategory` state initialized to `language`. Render three 32px tab buttons labeled `文本`, `生图`, `视频`, each with status text. Switching tabs must only change `activeCategory`; all connection drafts remain in `draft.connections`.

```tsx
const connection = draft.connections[activeCategory];
<ProviderConnectionEditor
  category={activeCategory}
  connection={connection}
  onChange={(next) => setDraft({
    ...draft,
    connections: { ...draft.connections, [activeCategory]: next },
  })}
  onTest={() => onTest(activeCategory)}
/>
```

- [ ] **Step 3: Add per-category validation and no-cost testing**

Reject saving a partially filled connection. Permit an absent connection. Test only the active category. If the gateway reports unsupported model discovery, preserve the manual model list and mark the connection `unverified`.

- [ ] **Step 4: Replace global activation with category activation**

Provider cards show status for each configured category and a separate activation button. For `pending`, `unverified`, or `unhealthy`, call `window.confirm` with the category, Host, and current status before `setActiveProvider(category, provider.id)`.

- [ ] **Step 5: Upgrade import/export**

Export `{ format, version: 2, activeProviderIds, providers }`. Import version 2 after structural validation; import version 1 through `migrateProviderStateV5`. Force every imported connection verification status to `pending`.

- [ ] **Step 6: Run client type checking**

Run: `npm run typecheck:client`

Expected: PASS with no legacy `activeProviderId` or shared connection-field references in the settings module.

- [ ] **Step 7: Commit the settings UI**

```bash
git add src/components/modals/settings/ApiSettings.tsx src/components/modals/settings/ProviderConnectionEditor.tsx
git commit -m "feat: configure provider connections by model type"
```

### Task 5: Migrate text-model consumers

**Files:**
- Modify: `src/components/canvas/Canvas.tsx`
- Modify: `src/components/nodes/TextNode.tsx`

**Interfaces:**
- Consumes: `activeProviderIds.language`, `providerSupportsCategory`, `getSelectedModel`.
- Produces: text requests that can only use a language connection.

- [ ] **Step 1: Replace global-provider lookup in Canvas**

Build language model options only from providers with a language connection. Resolve the fallback provider from `activeProviderIds.language`. Keep explicit `providerId::modelId` selections working only when that provider contains the selected language model.

- [ ] **Step 2: Replace global-provider lookup in TextNode**

Resolve explicit node provider first, then the active language provider, then the first provider with a language connection. Call `generateProviderText` with the unmodified provider and let the service resolve the language connection.

- [ ] **Step 3: Run client type checking**

Run: `npm run typecheck:client`

Expected: PASS and `rg -n "activeProviderId" src/components/canvas/Canvas.tsx src/components/nodes/TextNode.tsx` returns no matches.

- [ ] **Step 4: Commit text consumer migration**

```bash
git add src/components/canvas/Canvas.tsx src/components/nodes/TextNode.tsx
git commit -m "refactor: use language-specific providers"
```

### Task 6: Migrate image and video consumers

**Files:**
- Modify: `src/components/image-gen/ImageGeneration.tsx`
- Modify: `src/components/video-gen/VideoGeneration.tsx`
- Modify: `src/components/canvas/CanvasPromptOverlay.tsx`

**Interfaces:**
- Consumes: `activeProviderIds.image`, `activeProviderIds.video`, category-specific selectors, category-aware service functions.
- Produces: image and video requests that never read the language connection.

- [ ] **Step 1: Split image and video providers in ImageGeneration**

Resolve `imageProvider` from `activeProviderIds.image` and `videoProvider` from `activeProviderIds.video`. Use the provider matching `generationMode`, and preserve the current image-layout changes already present in the dirty worktree.

- [ ] **Step 2: Migrate VideoGeneration**

Replace `getActiveProvider` with the active video provider and read only its video models and selected model.

- [ ] **Step 3: Migrate CanvasPromptOverlay**

For image nodes resolve the explicit provider only if it has an image connection; otherwise use `activeProviderIds.image`, then the first image-capable provider. Pass the provider unchanged to `generateProviderImage`.

- [ ] **Step 4: Run client type checking**

Run: `npm run typecheck:client`

Expected: PASS and `rg -n "activeProviderId|getActiveProvider" src/components/image-gen src/components/video-gen src/components/canvas/CanvasPromptOverlay.tsx` returns no legacy global-provider use.

- [ ] **Step 5: Commit media consumer migration**

```bash
git add src/components/image-gen/ImageGeneration.tsx src/components/video-gen/VideoGeneration.tsx src/components/canvas/CanvasPromptOverlay.tsx
git commit -m "refactor: use media-specific providers"
```

### Task 7: Integrated regression verification

**Files:**
- Modify only files required by failures found in this verification task.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a fully verified category-specific Provider workflow.

- [ ] **Step 1: Run focused tests**

Run: `npx tsx --test server/providerConnections.test.ts server/providerService.test.ts server/providerGateway.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 2: Run the repository test suite**

Run: `npm test`

Expected: all server tests PASS.

- [ ] **Step 3: Run both type checks and lint**

Run: `npm run typecheck && npm run lint`

Expected: all commands exit 0 with no warnings.

- [ ] **Step 4: Run the stage build**

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 5: Browser verification**

Verify these scenarios in the running local app:

1. One provider with three different Host values retains each value when tabs switch.
2. A provider with only an image connection saves successfully.
3. Language, image, and video each activate a different provider.
4. Connection testing requests only `/models` and never generation endpoints.
5. An unverified connection warns once at activation and can then be used.
6. A simulated upstream error containing a Key is displayed without any Key fragment.
7. Migrated legacy connections display `待验证`.

If verification requires a correction, return to the task that owns the failing file, repeat that task's focused test cycle, and amend that task before declaring the stage complete. If verification finds no correction, create no extra commit.
