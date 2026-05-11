import { NextRequest, NextResponse } from 'next/server';
import { getSessionWallet } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import {
  LISTING_IMAGE_FORMAT_LABEL,
  MAX_LISTING_IMAGE_BYTES,
  isAllowedListingImageType,
} from '@/lib/imageUploads';
import { createServerClient } from '@/lib/supabase';

const BUCKET_NAME = 'listing-images';

/**
 * POST /api/upload
 * Upload one or more images to Supabase Storage.
 *
 * Expects multipart/form-data with:
 * - files: File[] (1-5 images)
 * - wallet: string (seller wallet for path organization)
 *
 * Returns: { urls: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const formData = await request.formData();

    const wallet = formData.get('wallet') as string;
    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet address' },
        { status: 400 }
      );
    }

    const sessionWallet = getSessionWallet(request);
    if (!sessionWallet || sessionWallet !== wallet) {
      return NextResponse.json(
        { error: 'Wallet session required for upload' },
        { status: 401 }
      );
    }

    const files = formData.getAll('files') as File[];
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (files.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 files allowed' },
        { status: 400 }
      );
    }

    const urls: string[] = [];

    for (const file of files) {
      // Validate file type
      if (!isAllowedListingImageType(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Allowed: ${LISTING_IMAGE_FORMAT_LABEL}` },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_LISTING_IMAGE_BYTES) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Maximum 5MB` },
          { status: 400 }
        );
      }

      // Generate unique file path: wallet/timestamp-random.ext
      const ext = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filePath = `${wallet}/${timestamp}-${random}.${ext}`;

      // Convert File to ArrayBuffer for upload
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: file.type,
          cacheControl: '31536000', // 1 year cache
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
          { error: `Upload failed: ${error.message}` },
          { status: 500 }
        );
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);

      urls.push(publicUrl);
    }

    return NextResponse.json({ urls }, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/upload error:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Upload failed') },
      { status: 500 }
    );
  }
}
