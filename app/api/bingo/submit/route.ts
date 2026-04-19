import { NextRequest, NextResponse } from 'next/server';
import { findByCodigo } from '@/lib/users';
import { getGameState, isCurrentSessionSubmission, saveSubmission } from '@/lib/bingo';

const PHOTO_COUNT = 8;

export async function POST(req: NextRequest) {
  try {
    const { codigo, keys } = await req.json() as { codigo: string; keys: string[] };

    if (!codigo || !Array.isArray(keys)) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    const normalizedCodigo = codigo.toUpperCase().trim();

    if (keys.length !== PHOTO_COUNT) {
      return NextResponse.json(
        { message: `Se requieren exactamente ${PHOTO_COUNT} fotos` },
        { status: 400 }
      );
    }

    const invalidKey = keys.find((k) => !k.startsWith(`bingo/${normalizedCodigo}/`));
    if (invalidKey) {
      return NextResponse.json({ message: 'Clave de archivo no permitida' }, { status: 403 });
    }

    const group = await findByCodigo(normalizedCodigo);
    if (!group) {
      return NextResponse.json({ message: 'Código de invitación inválido' }, { status: 403 });
    }

    const game = await getGameState();
    if (game.status !== 'started') {
      return NextResponse.json({ message: 'El juego no está activo' }, { status: 403 });
    }

    const alreadySubmitted = await isCurrentSessionSubmission(normalizedCodigo, game.startedAt!);
    if (alreadySubmitted) {
      return NextResponse.json({ message: 'Ya enviaste tus fotos para este juego' }, { status: 409 });
    }

    const names = group.usuarios.map((u) => u.nombre);

    await saveSubmission({
      codigo: normalizedCodigo,
      names,
      submittedAt: new Date().toISOString(),
      photoKeys: keys,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
