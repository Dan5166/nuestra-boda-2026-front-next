import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { getGallerySettings, saveGallerySettings, GallerySettings } from '@/lib/gallery';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyJwt(token) : null;
}

export async function GET(_req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const settings = await getGallerySettings();
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const settings: GallerySettings = {
      maxPhotosPerCode: Number(body.maxPhotosPerCode),
      maxVideosPerCode: Number(body.maxVideosPerCode),
      maxFileSizeMB: Number(body.maxFileSizeMB),
      enabled: Boolean(body.enabled),
      deletionLocked: Boolean(body.deletionLocked),
    };

    if (
      isNaN(settings.maxPhotosPerCode) ||
      isNaN(settings.maxVideosPerCode) ||
      isNaN(settings.maxFileSizeMB)
    ) {
      return NextResponse.json({ message: 'Valores inválidos' }, { status: 400 });
    }

    await saveGallerySettings(settings);
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
