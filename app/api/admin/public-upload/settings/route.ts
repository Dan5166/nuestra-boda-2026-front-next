import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import {
  getPublicUploadSettings,
  savePublicUploadSettings,
  PublicUploadSettings,
} from '@/lib/gallery';

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
    return NextResponse.json(await getPublicUploadSettings());
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
    const settings: PublicUploadSettings = {
      enabled: Boolean(body.enabled),
      maxFileSizeMBPhoto: Number(body.maxFileSizeMBPhoto),
      maxFileSizeMBVideo: Number(body.maxFileSizeMBVideo),
      maxPhotosPerSession: Number(body.maxPhotosPerSession),
      maxVideosPerSession: Number(body.maxVideosPerSession),
      maxPhotosTotal: Number(body.maxPhotosTotal),
      maxVideosTotal: Number(body.maxVideosTotal),
    };

    const nums = [
      settings.maxFileSizeMBPhoto,
      settings.maxFileSizeMBVideo,
      settings.maxPhotosPerSession,
      settings.maxVideosPerSession,
      settings.maxPhotosTotal,
      settings.maxVideosTotal,
    ];
    if (nums.some(isNaN)) {
      return NextResponse.json({ message: 'Valores inválidos' }, { status: 400 });
    }

    await savePublicUploadSettings(settings);
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
