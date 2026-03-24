import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { overrideBingoCell } from '@/lib/bingo';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyJwt(token) : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string; position: string }> }
) {
  if (!(await requireAdmin())) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });

  try {
    const { codigo, position } = await params;
    const { newTargetCodigo } = await req.json();

    if (!newTargetCodigo) return NextResponse.json({ message: 'Falta newTargetCodigo' }, { status: 400 });

    await overrideBingoCell(codigo, Number(position), newTargetCodigo.toUpperCase());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
