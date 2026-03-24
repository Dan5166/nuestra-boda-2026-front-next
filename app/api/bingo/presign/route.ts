import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl } from '@/lib/s3';
import { getBingoSettings, getBingoCard } from '@/lib/bingo';
import { findByCodigo } from '@/lib/users';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(req: NextRequest) {
  try {
    const { codigo, position, fileName, contentType } = await req.json();

    if (!codigo || position === undefined || !fileName || !contentType) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    const [group, settings, card] = await Promise.all([
      findByCodigo(codigo),
      getBingoSettings(),
      getBingoCard(codigo),
    ]);

    if (!group) return NextResponse.json({ message: 'Código inválido' }, { status: 403 });
    if (!settings.enabled) return NextResponse.json({ message: 'El bingo está desactivado' }, { status: 403 });
    if (!card) return NextResponse.json({ message: 'No tienes cartón de bingo' }, { status: 404 });

    const cell = card.cells.find((c) => c.position === position);
    if (!cell) return NextResponse.json({ message: 'Posición inválida' }, { status: 400 });
    if (cell.completedAt) return NextResponse.json({ message: 'Esta casilla ya está completada' }, { status: 409 });

    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json({ message: 'Tipo de archivo no permitido' }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `bingo/${codigo}/${position}/${timestamp}-${safeFileName}`;

    const url = await getPresignedUploadUrl(key, contentType, 300);
    return NextResponse.json({ url, key });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
