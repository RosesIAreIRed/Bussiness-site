import { describe, expect, it } from 'vitest';
import {
  CREATIVE_IMAGE_FORMATS,
  CREATIVE_VIDEO_DURATIONS_SEC,
  getImageFormat,
  isSupportedVideoDuration,
} from '../src/formats.js';

describe('CREATIVE_IMAGE_FORMATS', () => {
  it('містить рівно формати 9:16, 4:5 та 1:1', () => {
    expect(CREATIVE_IMAGE_FORMATS.map((format) => format.aspectRatio)).toEqual([
      '9:16',
      '4:5',
      '1:1',
    ]);
  });

  it('розміри узгоджені з aspect ratio', () => {
    for (const format of CREATIVE_IMAGE_FORMATS) {
      const [aspectWidth, aspectHeight] = format.aspectRatio.split(':').map(Number);
      expect(format.width * aspectHeight!).toBe(format.height * aspectWidth!);
    }
  });

  it('getImageFormat повертає формат або кидає помилку', () => {
    expect(getImageFormat('story')).toMatchObject({ width: 1080, height: 1920 });
    expect(() => getImageFormat('banner' as never)).toThrow('Невідомий формат');
  });
});

describe('CREATIVE_VIDEO_DURATIONS_SEC', () => {
  it('підтримує 10, 15, 20 і 30 секунд', () => {
    expect([...CREATIVE_VIDEO_DURATIONS_SEC]).toEqual([10, 15, 20, 30]);
    expect(isSupportedVideoDuration(15)).toBe(true);
    expect(isSupportedVideoDuration(45)).toBe(false);
  });
});
