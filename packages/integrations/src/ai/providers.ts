import type { ZodType } from 'zod';
import type {
  GeneratedAsset,
  GeneratedAudio,
  GeneratedVideo,
  ImageGenerationInput,
  TtsInput,
  VideoGenerationInput,
} from './types.js';

/**
 * Adapter-інтерфейси AI-провайдерів.
 * Система не привʼязується до конкретного вендора: mock-реалізації
 * зʼявляються в Milestone 2, реальні провайдери — окремими adapter-ами.
 * `schema` типізована як ZodType<T>, щоб output обовʼязково проходив
 * runtime-валідацію (structured JSON), а не лише compile-time типи.
 */
export interface StructuredGenerationInput<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  model?: string;
  temperature?: number;
}

export interface TextGenerationProvider {
  generateStructured<T>(input: StructuredGenerationInput<T>): Promise<T>;
}

export interface ImageGenerationProvider {
  generate(input: ImageGenerationInput): Promise<GeneratedAsset[]>;
}

export interface TextToSpeechProvider {
  synthesize(input: TtsInput): Promise<GeneratedAudio>;
}

export interface VideoGenerationProvider {
  generate(input: VideoGenerationInput): Promise<GeneratedVideo>;
}
