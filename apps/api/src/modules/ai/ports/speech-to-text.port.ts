export interface SpeechToTextProvider {
  transcribe(input: { buffer: Buffer; mimeType: string }): Promise<{ text: string }>;
}
