/** Метадані ліцензії asset-а — обовʼязкові для third-party матеріалів. */
export interface AssetLicense {
  source: string;
  licenseType: string;
  attribution?: string;
}

export interface GeneratedAsset {
  mimeType: string;
  width: number;
  height: number;
  bytes: Uint8Array;
  provider: string;
  model?: string;
  seed?: number;
  license?: AssetLicense;
}

export interface ImageGenerationInput {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  count?: number;
  seed?: number;
}

export interface TtsInput {
  text: string;
  voice?: string;
  languageCode?: string;
  format?: 'mp3' | 'wav';
}

export interface GeneratedAudio {
  mimeType: string;
  bytes: Uint8Array;
  durationSec?: number;
  provider: string;
  voice?: string;
}

export interface VideoGenerationInput {
  prompt: string;
  durationSec: number;
  width: number;
  height: number;
  referenceAssets?: GeneratedAsset[];
}

export interface GeneratedVideo {
  mimeType: string;
  bytes: Uint8Array;
  durationSec: number;
  width: number;
  height: number;
  provider: string;
}
