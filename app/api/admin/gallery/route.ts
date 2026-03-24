import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { listAllUploads, deleteUpload } from '@/lib/s3';
import { getAllUsers } from '@/lib/users';
import { getAllMedia, deleteMediaMetadata } from '@/lib/gallery';

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
    const [files, users, mediaRecords] = await Promise.all([
      listAllUploads(),
      getAllUsers(),
      getAllMedia(),
    ]);

    // codigo -> names
    const namesByCodigo: Record<string, string[]> = {};
    for (const user of users) {
      if (!namesByCodigo[user.codigo]) namesByCodigo[user.codigo] = [];
      namesByCodigo[user.codigo].push(user.nombre);
    }

    // s3Key -> metadata
    const metaByKey = new Map(mediaRecords.map((m) => [m.s3Key, m]));

    const enriched = files.map((f) => {
      const meta = metaByKey.get(f.key);
      return {
        ...f,
        names: namesByCodigo[f.codigo] ?? [],
        involvedCodes: meta?.involvedCodes ?? [],
        involvedNames: (meta?.involvedCodes ?? []).flatMap(
          (c) => namesByCodigo[c] ?? []
        ),
      };
    });

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

    await Promise.all([deleteUpload(key), deleteMediaMetadata(key)]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
