import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canvasImageCapability,
  defaultCanvasImageParameters,
  resolveCanvasImageParameters,
} from '../src/lib/canvasImageCapabilities';

const protocols = ['responses', 'chat-completions'] as const;
const editModels = [
  'gpt-image-1-mini', 'gpt-image-1.5', 'gpt-image-2', 'gpt-image-2-2026-04-21',
  'gpt-image-2.5-sunburst', 'gpt-image-2.5-sunburst-2026-09-08',
  'gpt-image-2.5-flare', 'gpt-image-2.5-flare-2026-09-08', 'chatgpt-image-latest',
];

test('only exact GPT edits allowlist permits one reference on supported protocols', () => {
  for (const protocol of protocols) {
    for (const model of editModels) {
      const capability = canvasImageCapability(protocol, model);
      assert.equal(capability.maxReferences, 1);
      assert.deepEqual(capability.ratios, ['1:1', '16:9', '9:16']);
      assert.deepEqual(capability.qualities.map(({ value }) => value), ['medium', 'high', 'low', 'auto']);
      assert.ok(capability.qualities.every(({ label }) => label.length > 0));
    }
    for (const model of ['dall-e-3', 'dall-e-2', 'unknown', '', 'gpt-image-1', 'gpt-image-99', 'vendor/gpt-image-2', 'gpt-image-2-custom', 'GPT-IMAGE-2']) {
      assert.equal(canvasImageCapability(protocol, model).maxReferences, 0, model);
    }
  }
});

test('GPT native qualities and legacy aliases resolve without mutating persisted data', () => {
  for (const protocol of protocols) {
    for (const [input, output] of [['standard', 'medium'], ['hd', 'high'], ['low', 'low'], ['medium', 'medium'], ['high', 'high'], ['auto', 'auto']]) {
      const data = Object.freeze({ aspectRatio: '16:9', quality: input });
      assert.deepEqual(resolveCanvasImageParameters(protocol, 'gpt-image-2', data), {
        aspectRatio: '16:9', quality: output, size: '1536x1024',
      });
      assert.equal(data.quality, input);
    }
    assert.equal(resolveCanvasImageParameters(protocol, 'gpt-image-2', { aspectRatio: '9:16' }).size, '1024x1536');
  }
});

test('DALL-E 3 uses its implemented sizes and standard/hd; unknown models keep generic canvas parameters', () => {
  for (const protocol of protocols) {
    for (const model of ['dall-e-3', 'unknown', 'vendor/gpt-image-2']) {
      assert.deepEqual(canvasImageCapability(protocol, model).qualities, [
        { value: 'standard', label: '标准' }, { value: 'hd', label: '高清' },
      ]);
      for (const quality of ['standard', 'hd']) {
        for (const [aspectRatio, gptSize, dallESize] of [
          ['1:1', '1024x1024', '1024x1024'],
          ['16:9', '1536x1024', '1792x1024'],
          ['9:16', '1024x1536', '1024x1792'],
        ]) {
          assert.deepEqual(resolveCanvasImageParameters(protocol, model, { aspectRatio, quality }), {
            aspectRatio, quality, size: model === 'dall-e-3' ? dallESize : gptSize,
          });
        }
      }
      for (const quality of ['low', 'medium', 'high', 'auto']) {
        assert.throws(() => resolveCanvasImageParameters(protocol, model, { quality }), /quality/);
      }
    }
  }
});

test('only missing parameters default; invalid persisted values explicitly fail', () => {
  for (const model of ['gpt-image-2', 'dall-e-3', 'unknown']) {
    for (const aspectRatio of [null, '', 'auto', '3:2', '4:3', '16:9 ', 1, false, [], {}]) {
      assert.throws(() => resolveCanvasImageParameters('responses', model, { aspectRatio }), /aspectRatio/);
    }
    for (const quality of [null, '', 'ultra', 'HD', 'standard ', 1, false, [], {}]) {
      assert.throws(() => resolveCanvasImageParameters('responses', model, { quality }), /quality/);
    }
    const defaults = defaultCanvasImageParameters('responses', model);
    assert.deepEqual(defaults, { aspectRatio: '1:1', quality: model === 'gpt-image-2' ? 'medium' : 'standard' });
    assert.deepEqual(resolveCanvasImageParameters('responses', model, {}), { ...defaults, size: '1024x1024' });
    assert.deepEqual(resolveCanvasImageParameters('responses', model, { aspectRatio: undefined, quality: undefined }), {
      ...defaults, size: '1024x1024',
    });
  }
});

test('model-switch defaults clear incompatible GPT quality rather than silently accepting it', () => {
  const old = { aspectRatio: '9:16', quality: 'high' };
  assert.throws(() => resolveCanvasImageParameters('responses', 'dall-e-3', old), /quality/);
  const changed = { ...old, ...defaultCanvasImageParameters('responses', 'dall-e-3') };
  assert.deepEqual(resolveCanvasImageParameters('responses', 'dall-e-3', changed), {
    aspectRatio: '1:1', quality: 'standard', size: '1024x1024',
  });
});

test('unsupported protocol is rejected by every export even for a whitelisted model', () => {
  assert.throws(() => canvasImageCapability('anthropic-messages', 'gpt-image-2'), /不支持/);
  assert.throws(() => defaultCanvasImageParameters('anthropic-messages', 'gpt-image-2'), /不支持/);
  assert.throws(() => resolveCanvasImageParameters('anthropic-messages', 'gpt-image-2', {}), /不支持/);
});
