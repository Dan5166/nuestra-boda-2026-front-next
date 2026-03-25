import { NextRequest, NextResponse } from 'next/server';
import { getGallerySettings, deleteMediaMetadata, getMediaForCode } from '@/lib/gallery';
import { deleteUpload } from '@/lib/s3';

export async function DELETE(req: NextRequest) {
  try {
    const { codigo, key } = await req.json();

    if (!codigo || !key) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    const settings = await getGallerySettings();
    if (settings.deletionLocked) {
      return NextResponse.json({ message: 'El borrado está bloqueado' }, { status: 403 });
    }

    // Verify ownership: only the uploader can delete
    const files = await getMediaForCode(codigo);
    const file = files.find((f) => f.s3Key === key && f.uploadedBy === codigo);
    if (!file) {
      return NextResponse.json({ message: 'No autorizado o archivo no encontrado' }, { status: 403 });
    }

    await Promise.all([deleteUpload(key), deleteMediaMetadata(key)]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
