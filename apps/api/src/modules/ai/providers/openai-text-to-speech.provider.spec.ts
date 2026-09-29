import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAiTextToSpeechProvider } from './openai-text-to-speech.provider';

test('OpenAI TTS adapter maps response bytes and safe mime type', async () => {
  const client = {
    audio: {
      speech: {
        create: async (input: any) => {
          assert.deepEqual(input, { model: 'tts-model', voice: 'alloy', input: 'Olá' });
          return new Response(Buffer.from('audio bytes'), { headers: { 'content-type': 'audio/mpeg' } });
        },
      },
    },
  };
  const provider = new OpenAiTextToSpeechProvider(
    { get: (key: string) => ({ OPENAI_TTS_MODEL: 'tts-model', OPENAI_API_KEY: 'test-key' } as any)[key] } as any,
    () => client as any,
  );

  const result = await provider.synthesize({ text: 'Olá', voice: 'alloy' });

  assert.deepEqual(result, { audio: Buffer.from('audio bytes'), mimeType: 'audio/mpeg' });
});

test('OpenAI TTS adapter sanitizes synthesis failures', async () => {
  const provider = new OpenAiTextToSpeechProvider(
    { get: (key: string) => ({ OPENAI_TTS_MODEL: 'tts-model', OPENAI_API_KEY: 'test-key' } as any)[key] } as any,
    () => ({ audio: { speech: { create: async () => { throw new Error('test-key raw audio token'); } } } }) as any,
  );

  await assert.rejects(() => provider.synthesize({ text: 'Olá', voice: 'alloy' }), (error: Error) => {
    assert.equal(error.message, 'Text-to-speech provider request failed');
    assert.doesNotMatch(error.message, /test-key|audio token/);
    return true;
  });
});
