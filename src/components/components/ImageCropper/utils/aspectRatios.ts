export interface AspectRatioPreset {
  label: string;
  value: number | 'free';
}

export const ASPECT_RATIOS: AspectRatioPreset[] = [
  { label: 'Free', value: 'free' },
  { label: '1:1 Square', value: 1 },
  { label: '16:9 Landscape', value: 16 / 9 },
  { label: '9:16 Portrait', value: 9 / 16 },
  { label: '4:3 Standard', value: 4 / 3 },
  { label: '3:2 Classic', value: 3 / 2 },
];

/**
 * Calculates height based on width and aspect ratio.
 */
export const calculateHeight = (width: number, ratio: number | 'free', currentHeight: number): number => {
  if (ratio === 'free') return currentHeight;
  return width / ratio;
};

/**
 * Calculates width based on height and aspect ratio.
 */
export const calculateWidth = (height: number, ratio: number | 'free', currentWidth: number): number => {
  if (ratio === 'free') return currentWidth;
  return height * ratio;
};
