import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { getSiteSettings, saveSiteSettings, SiteSettings } from '@/lib/siteSettings';

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
    const settings = await getSiteSettings();
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
    const settings: SiteSettings = {
      homePage: body.homePage === 'menu' ? 'menu' : 'landing',
    };
    await saveSiteSettings(settings);
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
