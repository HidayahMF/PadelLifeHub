// Unit tests for the real geminiService module (no mocking).
// These run in their own process (node --test), so the module-level client is
// built with the environment as it is here — i.e. no GEMINI_API_KEY.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

const SERVICE_PATH = require.resolve('../services/geminiService');

function freshService() {
  delete require.cache[SERVICE_PATH];
  return require('../services/geminiService');
}

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

test('isConfigured() is false without GEMINI_API_KEY', () => {
  assert.strictEqual(freshService().isConfigured(), false);
});

test('generate() rejects with code AI_NOT_CONFIGURED without an API key', async () => {
  await assert.rejects(freshService().generate('hello world'), (err) => {
    assert.strictEqual(err.code, 'AI_NOT_CONFIGURED');
    return true;
  });
});

test('default model is gemini-3.6-flash when GEMINI_MODEL is unset', () => {
  assert.strictEqual(freshService().MODEL, 'gemini-3.6-flash');
});

test('GEMINI_MODEL env var overrides the default model', () => {
  process.env.GEMINI_MODEL = 'gemini-2.5-pro';
  assert.strictEqual(freshService().MODEL, 'gemini-2.5-pro');
});

test('system prompt exists and never leaks placeholder secrets', () => {
  const prompt = freshService().SYSTEM_PROMPT;
  assert.ok(prompt.includes('LifeHub AI'));
  assert.ok(!prompt.includes('AIza'));
  assert.ok(!prompt.includes('api key:'));
});

test('generate() accepts maxOutputTokens option without error', async () => {
  const svc = freshService();
  await assert.rejects(
    svc.generate('test prompt', { maxOutputTokens: 1024 }),
    (err) => {
      assert.strictEqual(err.code, 'AI_NOT_CONFIGURED');
      return true;
    }
  );
});
