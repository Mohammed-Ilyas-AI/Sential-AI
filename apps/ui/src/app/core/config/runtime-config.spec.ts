import { describe, expect, it } from 'vitest';
import { LOCAL_RUNTIME_CONFIG, loadRuntimeConfig } from './runtime-config';

const respondWith = (response: Response): typeof fetch => () => Promise.resolve(response);

describe('loadRuntimeConfig', () => {
  it('overlays runtime-config.json on the local defaults', async () => {
    const config = await loadRuntimeConfig(respondWith(Response.json({ streamUrl: 'wss://stream.example.test/stream' })));
    expect(config).toEqual({ ...LOCAL_RUNTIME_CONFIG, streamUrl: 'wss://stream.example.test/stream' });
  });

  it('falls back to the local defaults when the file is missing or malformed', async () => {
    expect(await loadRuntimeConfig(respondWith(new Response('', { status: 404 })))).toEqual(LOCAL_RUNTIME_CONFIG);
    expect(await loadRuntimeConfig(respondWith(Response.json({ streamUrl: 42 })))).toEqual(LOCAL_RUNTIME_CONFIG);
    expect(await loadRuntimeConfig(() => Promise.reject(new Error('offline')))).toEqual(LOCAL_RUNTIME_CONFIG);
  });
});
