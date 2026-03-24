import { NextRequest, NextResponse } from 'next/server';
import { findByCodigo, getAllUsers } from '@/lib/users';
import { getBingoCard, getBingoSettings } from '@/lib/bingo';

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_S3_BUCKET!;

function s3Url(key: string) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

export async function GET(req: NextRequest) {
  try {
    const codigo = req.nextUrl.searchParams.get('codigo')?.toUpperCase();
    if (!codigo) return NextResponse.json({ message: 'Falta el código' }, { status: 400 });

    const [group, settings, card, users] = await Promise.all([
      findByCodigo(codigo),
      getBingoSettings(),
      getBingoCard(codigo),
      getAllUsers(),
    ]);

    if (!group) return NextResponse.json({ message: 'Código inválido' }, { status: 403 });

    // Build codigo → names map
    const namesByCodigo: Record<string, string[]> = {};
    for (const u of users) {
      if (!namesByCodigo[u.codigo]) namesByCodigo[u.codigo] = [];
      namesByCodigo[u.codigo].push(u.nombre);
    }

    return NextResponse.json({
      settings,
      card: card
        ? {
            ...card,
            cells: card.cells.map((c) => ({
              ...c,
              targetNames: namesByCodigo[c.targetCodigo] ?? [c.targetCodigo],
              mediaUrl: c.mediaKey ? s3Url(c.mediaKey) : null,
            })),
          }
        : null,
    });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
