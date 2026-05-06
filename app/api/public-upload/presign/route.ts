import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl, listUploadsByCodigo } from '@/lib/s3';
import { getPublicUploadSettings } from '@/lib/gallery';

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm'];

export async function POST(req: NextRequest) {
  try {
    const { fileName, contentType } = await req.json();

    if (!fileName || !contentType) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    const settings = await getPublicUploadSettings();
    if (!settings.enabled) {
      return NextResponse.json({ message: 'Las subidas públicas están desactivadas' }, { status: 403 });
    }

    const isPhoto = ALLOWED_PHOTO_TYPES.includes(contentType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);

    if (!isPhoto && !isVideo) {
      return NextResponse.json({ message: 'Tipo de archivo no permitido' }, { status: 400 });
    }

    const maxSizeMB = isPhoto ? settings.maxFileSizeMBPhoto : settings.maxFileSizeMBVideo;

    // Check global totals against S3
    const existing = await listUploadsByCodigo('publico');
    const existingPhotos = existing.filter((f) =>
      PHOTO_EXTS.includes(f.key.split('.').pop()?.toLowerCase() ?? '')
    );
    const existingVideos = existing.filter((f) =>
      VIDEO_EXTS.includes(f.key.split('.').pop()?.toLowerCase() ?? '')
    );

    if (isPhoto && existingPhotos.length >= settings.maxPhotosTotal) {
      return NextResponse.json(
        { message: `Límite total de fotos alcanzado (${settings.maxPhotosTotal})` },
        { status: 429 }
      );
    }
    if (isVideo && existingVideos.length >= settings.maxVideosTotal) {
      return NextResponse.json(
        { message: `Límite total de videos alcanzado (${settings.maxVideosTotal})` },
        { status: 429 }
      );
    }

    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/publico/${timestamp}-${safeFileName}`;

    const url = await getPresignedUploadUrl(key, contentType, 300);

    return NextResponse.json({ url, key, maxSizeMB });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
