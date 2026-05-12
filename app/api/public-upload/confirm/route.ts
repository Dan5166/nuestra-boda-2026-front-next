import { NextRequest, NextResponse } from 'next/server';
import { saveMediaMetadata } from '@/lib/gallery';

export async function POST(req: NextRequest) {
  try {
    const { key, size, uploaderName } = await req.json();

    if (!key) {
      return NextResponse.json({ message: 'Falta la clave' }, { status: 400 });
    }

    if (!key.startsWith('uploads/publico/')) {
      return NextResponse.json({ message: 'Clave no permitida' }, { status: 403 });
    }

    const safeName =
      typeof uploaderName === 'string' ? uploaderName.trim().slice(0, 100) : '';

    await saveMediaMetadata({
      s3Key: key,
      uploadedBy: 'publico',
      involvedCodes: [],
      uploadedAt: new Date().toISOString(),
      size: typeof size === 'number' ? size : 0,
      showInGallery: false,
      ...(safeName ? { uploaderName: safeName } : {}),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
