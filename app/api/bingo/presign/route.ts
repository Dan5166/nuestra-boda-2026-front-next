import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl } from '@/lib/s3';
import { findByCodigo } from '@/lib/users';
import { getGameState, isCurrentSessionSubmission } from '@/lib/bingo';

const PHOTO_COUNT = 8;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export async function POST(req: NextRequest) {
  try {
    const { codigo, files } = await req.json() as {
      codigo: string;
      files: Array<{ name: string; type: string }>;
    };

    if (!codigo || !Array.isArray(files)) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    if (files.length !== PHOTO_COUNT) {
      return NextResponse.json(
        { message: `Debés enviar exactamente ${PHOTO_COUNT} fotos. Enviaste ${files.length}.` },
        { status: 400 }
      );
    }

    const invalidType = files.find((f) => !ALLOWED_TYPES.includes(f.type));
    if (invalidType) {
      return NextResponse.json({ message: `Tipo de archivo no permitido: ${invalidType.type}` }, { status: 400 });
    }

    const group = await findByCodigo(codigo.toUpperCase().trim());
    if (!group) {
      return NextResponse.json({ message: 'Código de invitación inválido' }, { status: 403 });
    }

    const game = await getGameState();
    if (game.status !== 'started') {
      return NextResponse.json({ message: 'El juego no está activo' }, { status: 403 });
    }

    const alreadySubmitted = await isCurrentSessionSubmission(codigo.toUpperCase().trim(), game.startedAt!);
    if (alreadySubmitted) {
      return NextResponse.json({ message: 'Ya enviaste tus fotos para este juego' }, { status: 409 });
    }

    const timestamp = Date.now();
    const urls = await Promise.all(
      files.map(async (f, i) => {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `bingo/${codigo.toUpperCase().trim()}/${timestamp}-${i + 1}-${safe}`;
        const url = await getPresignedUploadUrl(key, f.type, 600);
        return { url, key };
      })
    );

    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
