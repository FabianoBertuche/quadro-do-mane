import type { AiServerModel } from '../ai-server-runtime.service';

export const OLLAMA_CLOUD_MODELS: readonly AiServerModel[] = Object.freeze([
  Object.freeze({ slug: 'gemma4:31b', displayName: 'Gemma 4 31B' }),
  Object.freeze({ slug: 'gpt-oss:120b', displayName: 'GPT-OSS 120B' }),
  Object.freeze({ slug: 'gpt-oss:20b', displayName: 'GPT-OSS 20B' }),
  Object.freeze({ slug: 'nemotron-3-nano:30b', displayName: 'Nemotron 3 Nano 30B' }),
  Object.freeze({ slug: 'nemotron-3-super', displayName: 'Nemotron 3 Super' }),
  Object.freeze({ slug: 'nemotron-3-ultra', displayName: 'Nemotron 3 Ultra' }),
]);