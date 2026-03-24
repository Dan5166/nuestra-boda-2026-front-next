import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl, listUploadsByCodigo } from '@/lib/s3';
import { getGallerySettings } from '@/lib/gallery';
import { findByCodigo } from '@/lib/users';

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export async function POST(req: NextRequest) {
  try {
    const { codigo, fileName, contentType } = await req.json();

    if (!codigo || !fileName || !contentType) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Validate the invitation code exists
    const group = await findByCodigo(codigo);
    if (!group) {
      return NextResponse.json({ message: 'Código de invitación inválido' }, { status: 403 });
    }

    const settings = await getGallerySettings();

    if (!settings.enabled) {
      return NextResponse.json({ message: 'La galería está desactivada' }, { status: 403 });
    }

    const isPhoto = ALLOWED_PHOTO_TYPES.includes(contentType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);

    if (!isPhoto && !isVideo) {
      return NextResponse.json({ message: 'Tipo de archivo no permitido' }, { status: 400 });
    }

    // Count existing uploads for this code
    const existing = await listUploadsByCodigo(codigo);
    const existingPhotos = existing.filter((f) => {
      const ext = f.key.split('.').pop()?.toLowerCase();
      return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext ?? '');
    });
    const existingVideos = existing.filter((f) => {
      const ext = f.key.split('.').pop()?.toLowerCase();
      return ['mp4', 'mov', 'webm'].includes(ext ?? '');
    });

    if (isPhoto && existingPhotos.length >= settings.maxPhotosPerCode) {
      return NextResponse.json(
        { message: `Límite de fotos alcanzado (${settings.maxPhotosPerCode})` },
        { status: 429 }
      );
    }

    if (isVideo && existingVideos.length >= settings.maxVideosPerCode) {
      return NextResponse.json(
        { message: `Límite de videos alcanzado (${settings.maxVideosPerCode})` },
        { status: 429 }
      );
    }

    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/${codigo}/${timestamp}-${safeFileName}`;

    const url = await getPresignedUploadUrl(key, contentType, 300);

    return NextResponse.json({ url, key });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
