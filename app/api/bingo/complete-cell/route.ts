import { NextRequest, NextResponse } from 'next/server';
import { findByCodigo } from '@/lib/users';
import { completeBingoCell, getBingoCard } from '@/lib/bingo';
import { saveMediaMetadata } from '@/lib/gallery';

export async function POST(req: NextRequest) {
  try {
    const { codigo, position, key, size } = await req.json();

    if (!codigo || position === undefined || !key) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    const group = await findByCodigo(codigo);
    if (!group) return NextResponse.json({ message: 'Código inválido' }, { status: 403 });

    // Security: key must match the expected prefix for this code + position
    if (!key.startsWith(`bingo/${codigo}/${position}/`)) {
      return NextResponse.json({ message: 'Clave no permitida' }, { status: 403 });
    }

    // Get the card before completing so we know the targetCodigo
    const card = await getBingoCard(codigo);
    if (!card) return NextResponse.json({ message: 'No tienes cartón de bingo' }, { status: 404 });

    const cell = card.cells.find((c) => c.position === position);
    if (!cell) return NextResponse.json({ message: 'Posición inválida' }, { status: 400 });
    if (cell.completedAt) return NextResponse.json({ message: 'Esta casilla ya está completada' }, { status: 409 });

    // Mark cell complete and save gallery metadata (auto-tag the target)
    const [updated] = await Promise.all([
      completeBingoCell(codigo, position, key),
      saveMediaMetadata({
        s3Key: key,
        uploadedBy: codigo,
        involvedCodes: [cell.targetCodigo],
        uploadedAt: new Date().toISOString(),
        size: typeof size === 'number' ? size : 0,
      }),
    ]);

    return NextResponse.json({ card: updated });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
