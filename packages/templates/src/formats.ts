export type ImageFormatKey = 'story' | 'portrait' | 'square';
export type AspectRatio = '9:16' | '4:5' | '1:1';

export interface CreativeImageFormat {
  key: ImageFormatKey;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
}

/** Канонічні розміри статичних креативів (Meta placements). */
export const CREATIVE_IMAGE_FORMATS: readonly CreativeImageFormat[] = [
  { key: 'story', aspectRatio: '9:16', width: 1080, height: 1920 },
  { key: 'portrait', aspectRatio: '4:5', width: 1080, height: 1350 },
  { key: 'square', aspectRatio: '1:1', width: 1080, height: 1080 },
] as const;

/** Підтримувані тривалості відеокреативів у секундах. */
export const CREATIVE_VIDEO_DURATIONS_SEC = [10, 15, 20, 30] as const;

export type VideoDurationSec = (typeof CREATIVE_VIDEO_DURATIONS_SEC)[number];

export function getImageFormat(key: ImageFormatKey): CreativeImageFormat {
  const format = CREATIVE_IMAGE_FORMATS.find((candidate) => candidate.key === key);
  if (!format) {
    throw new Error(`Невідомий формат креативу: ${key}`);
  }
  return format;
}

export function isSupportedVideoDuration(durationSec: number): durationSec is VideoDurationSec {
  return (CREATIVE_VIDEO_DURATIONS_SEC as readonly number[]).includes(durationSec);
}
