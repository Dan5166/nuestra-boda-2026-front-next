import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { toggleVote } from '@/lib/playlist';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyJwt(token) : null;
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const { songId } = await params;
    const song = await toggleVote(songId, admin.username);
    if (!song) {
      return NextResponse.json({ message: 'Canción no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ song });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
