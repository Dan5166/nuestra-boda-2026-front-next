import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { listAllUploads, deleteUpload } from '@/lib/s3';
import { getAllUsers } from '@/lib/users';

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
    const [files, users] = await Promise.all([listAllUploads(), getAllUsers()]);

    // Build a map of codigo -> list of names
    const namesByCodigo: Record<string, string[]> = {};
    for (const user of users) {
      if (!namesByCodigo[user.codigo]) namesByCodigo[user.codigo] = [];
      namesByCodigo[user.codigo].push(user.nombre);
    }

    const enriched = files.map((f) => ({
      ...f,
      names: namesByCodigo[f.codigo] ?? [],
    }));

    return NextResponse.json({ files: enriched });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const { key } = await req.json();
    if (!key) return NextResponse.json({ message: 'Falta la clave' }, { status: 400 });

    await deleteUpload(key);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
