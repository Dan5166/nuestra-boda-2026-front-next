import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { getBingoSettings, saveBingoSettings } from '@/lib/bingo';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyJwt(token) : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  const settings = await getBingoSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  const body = await req.json();
  const cols = Math.max(2, Math.min(5, Number(body.cols) || 3));
  const enabled = Boolean(body.enabled);
  await saveBingoSettings({ cols, enabled });
  return NextResponse.json({ cols, enabled });
}
