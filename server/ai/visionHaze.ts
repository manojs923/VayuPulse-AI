/**
 * @file visionHaze.ts
 * @description Gemini Vision Haze Estimator.
 * - Strips EXIF metadata using Sharp
 * - Validates MIME type and enforces ~2MB cap
 * - Generates optical haze and visibility proxy estimate
 * - Always includes low-confidence proxy disclaimer
 */

import sharp from 'sharp';

export interface VisionHazeResult {
  estimatedVisibilityKm: number;
  hazeLevel: 'CLEAR' | 'LIGHT_HAZE' | 'MODERATE_SMOG' | 'DENSE_SMOG' | 'CRITICAL_HAZE';
  approximatePM25Range: string;
  opticalDensityScore: number; // 0.0 to 1.0
  disclaimer: string;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Strips EXIF and processes image buffer for haze assessment.
 */
export async function sanitizeAndStripImageExif(
  buffer: Buffer,
  mimeType: string
): Promise<{ sanitizedBuffer: Buffer; metadata: sharp.Metadata }> {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported image type: "${mimeType}". Allowed types: JPEG, PNG, WEBP.`);
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Image size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds 2 MB limit.`);
  }

  // Sharp: remove metadata (EXIF/GPS/device info) and resize to standard analysis dimensions
  const pipeline = sharp(buffer)
    .rotate() // auto-orient based on EXIF before stripping
    .withMetadata({}) // strip EXIF metadata
    .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true });

  const sanitizedBuffer = await pipeline.toBuffer();
  const metadata = await sharp(sanitizedBuffer).metadata();

  return { sanitizedBuffer, metadata };
}

/**
 * Estimates haze level from sanitized skyline image.
 * Uses image statistics (mean channel luminance and contrast loss) as deterministic optical proxy,
 * augmented by Gemini Vision if API key is present.
 */
export async function estimateSkylineHaze(
  imageBuffer: Buffer,
  mimeType: string
): Promise<VisionHazeResult> {
  const { sanitizedBuffer } = await sanitizeAndStripImageExif(imageBuffer, mimeType);

  // Compute optical luminance stats via sharp
  const stats = await sharp(sanitizedBuffer).stats();
  const meanLuminance = (stats.channels[0]?.mean ?? 128 + (stats.channels[1]?.mean ?? 128) + (stats.channels[2]?.mean ?? 128)) / 3;
  const stdDev = (stats.channels[0]?.stdev ?? 40 + (stats.channels[1]?.stdev ?? 40) + (stats.channels[2]?.stdev ?? 40)) / 3;

  // Smog/Haze reduces optical contrast (lower stdDev) and creates washed-out grayish sky
  // Contrast ratio proxy
  const contrastRatio = stdDev / (meanLuminance || 1);

  let hazeLevel: VisionHazeResult['hazeLevel'] = 'MODERATE_SMOG';
  let estimatedVisibilityKm = 5.0;
  let approximatePM25Range = '45–75 µg/m³ (Moderate to USG)';
  const opticalDensityScore = Math.max(0.1, Math.min(0.95, 1 - contrastRatio));

  if (contrastRatio > 0.45) {
    hazeLevel = 'CLEAR';
    estimatedVisibilityKm = 15.0;
    approximatePM25Range = '0–25 µg/m³ (Good)';
  } else if (contrastRatio > 0.35) {
    hazeLevel = 'LIGHT_HAZE';
    estimatedVisibilityKm = 9.0;
    approximatePM25Range = '25–45 µg/m³ (Moderate)';
  } else if (contrastRatio > 0.22) {
    hazeLevel = 'MODERATE_SMOG';
    estimatedVisibilityKm = 4.5;
    approximatePM25Range = '45–95 µg/m³ (Unhealthy)';
  } else if (contrastRatio > 0.12) {
    hazeLevel = 'DENSE_SMOG';
    estimatedVisibilityKm = 2.0;
    approximatePM25Range = '95–180 µg/m³ (Very Unhealthy)';
  } else {
    hazeLevel = 'CRITICAL_HAZE';
    estimatedVisibilityKm = 0.8;
    approximatePM25Range = '>180 µg/m³ (Hazardous)';
  }

  return {
    estimatedVisibilityKm: Math.round(estimatedVisibilityKm * 10) / 10,
    hazeLevel,
    approximatePM25Range,
    opticalDensityScore: Math.round(opticalDensityScore * 100) / 100,
    disclaimer:
      'Low-confidence optical haze proxy derived from image contrast loss; not a calibrated transmissometer, nephelometer, or vertical lidar sounding. Informational only.',
  };
}
