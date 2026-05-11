export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;

export const LISTING_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];

export const LISTING_IMAGE_FORMAT_LABEL = 'JPEG, PNG, WebP, AVIF';

export function isAllowedListingImageType(type: string): boolean {
  return LISTING_IMAGE_MIME_TYPES.includes(type);
}
