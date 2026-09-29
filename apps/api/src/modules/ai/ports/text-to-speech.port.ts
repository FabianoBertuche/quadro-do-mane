export interface TextToSpeechProvider {
  synthesize(input: { text: string; voice: string }): Promise<{ audio: Buffer; mimeType: string }>;
}
