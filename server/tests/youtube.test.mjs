import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.FRONTEND_URL = 'https://example.test';
process.env.GOOGLE_CALLBACK_URL = 'https://example.test/api/v1/auth/google/callback';
process.env.YOUTUBE_API_KEY = 'test-key';
const { getYouTubeDetails } = await import('../dist/services/YouTubeService.js');

test('YouTube metadata lookup handles success and upstream failures safely', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      assert.equal(url.hostname, 'www.googleapis.com');
      assert.equal(url.searchParams.get('id'), 'abcdefghijk');
      assert.equal(url.searchParams.get('key'), 'test-key');
      return Response.json({ items: [{ snippet: { title: 'Test video', channelTitle: 'Test artist' } }] });
    };
    assert.deepEqual(await getYouTubeDetails('abcdefghijk'), { title: 'Test video', channel: 'Test artist' });
    await assert.rejects(getYouTubeDetails('invalid'), /valid YouTube/);
    globalThis.fetch = async () => Response.json({ items: [] });
    await assert.rejects(getYouTubeDetails('abcdefghijk'), /not found/);
    globalThis.fetch = async () => Response.json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 });
    await assert.rejects(getYouTubeDetails('abcdefghijk'), /request limit/);
    globalThis.fetch = async () => new Response('', { status: 429 });
    await assert.rejects(getYouTubeDetails('abcdefghijk'), /request limit/);
    globalThis.fetch = async () => { throw new Error('network error with test-key'); };
    await assert.rejects(getYouTubeDetails('abcdefghijk'), error => error.message.includes('Could not reach') && !error.message.includes('test-key'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
