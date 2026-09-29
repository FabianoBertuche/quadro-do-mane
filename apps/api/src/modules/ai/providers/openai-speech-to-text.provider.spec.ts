import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAiSpeechToTextProvider } from './openai-speech-to-text.provider';

test('OpenAI STT adapter maps transcription text and sends configured model', async () => {
  let request: any;
  const client = {
    audio: {
      transcriptions: {
        create: async (input: any) => {
          request = input;
          return { text: 'Texto transcrito' };
        },
      },
    },
  };
  const provider = new OpenAiSpeechToTextProvider(
    { get: (key: string) => ({ OPENAI_STT_MODEL: 'stt-model', OPENAI_API_KEY: 'test-key' } as any)[key] } as any,
    () => client as any,
  );

  const result = await provider.transcribe({ buffer: Buffer.from('audio'), mimeType: 'audio/webm' });

  assert.deepEqual(result, { text: 'Texto transcrito' });
  assert.equal(request.model, 'stt-model');
  assert.equal(request.file.type, 'audio/webm');
});

test('OpenAI STT adapter sanitizes transcription failures', async () => {
  const provider = new OpenAiSpeechToTextProvider(
    { get: (key: string) => ({ OPENAI_STT_MODEL: 'stt-model', OPENAI_API_KEY: 'test-key' } as any)[key] } as any,
    () => ({ audio: { transcriptions: { create: async () => { throw new Error('test-key raw audio token'); } } } }) as any,
  );

  await assert.rejects(() => provider.transcribe({ buffer: Buffer.from('audio'), mimeType: 'audio/webm' }), (error: Error) => {
    assert.equal(error.message, 'Speech-to-text provider request failed');
    assert.doesNotMatch(error.message, /test-key|audio token/);
    return true;
  });
});
