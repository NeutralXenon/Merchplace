import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LISTING_IMAGE_FORMAT_LABEL,
  LISTING_IMAGE_MIME_TYPES,
  isAllowedListingImageType,
} from '../lib/imageUploads.ts';

test('listing uploads allow modern marketplace image formats including AVIF', () => {
  assert.ok(isAllowedListingImageType('image/jpeg'));
  assert.ok(isAllowedListingImageType('image/png'));
  assert.ok(isAllowedListingImageType('image/webp'));
  assert.ok(isAllowedListingImageType('image/avif'));
  assert.ok(LISTING_IMAGE_MIME_TYPES.includes('image/avif'));
  assert.match(LISTING_IMAGE_FORMAT_LABEL, /AVIF/);
});

test('listing uploads reject unsupported image formats', () => {
  assert.equal(isAllowedListingImageType('image/gif'), false);
  assert.equal(isAllowedListingImageType('image/svg+xml'), false);
  assert.equal(isAllowedListingImageType(''), false);
});
