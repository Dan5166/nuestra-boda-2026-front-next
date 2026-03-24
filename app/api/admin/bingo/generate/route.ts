import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { getAllUsers } from '@/lib/users';
import { getBingoSettings, generateBingoCards } from '@/lib/bingo';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyJwt(token) : null;
}

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });

  try {
    const [users, settings] = await Promise.all([getAllUsers(), getBingoSettings()]);

    // Unique codes from confirmed guests
    const codes = [...new Set(users.filter((u) => u.estado === 'confirmado').map((u) => u.codigo))];

    const result = await generateBingoCards(codes, settings.cols);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
