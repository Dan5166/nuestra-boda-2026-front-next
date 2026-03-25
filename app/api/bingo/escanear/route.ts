import { NextRequest, NextResponse } from 'next/server';
import { resolveQRToken, getBingoCard, getBingoSettings } from '@/lib/bingo';
import { findByCodigo, getAllUsers } from '@/lib/users';

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_S3_BUCKET!;

function s3Url(key: string) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

/**
 * GET /api/bingo/escanear?t=TOKEN[&codigo=MYCODE]
 *
 * Without `codigo`: returns target info only (for showing who the QR is for).
 * With `codigo`: also looks up the matching cell on that guest's card.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('t');
    const codigo = req.nextUrl.searchParams.get('codigo')?.toUpperCase();

    if (!token) return NextResponse.json({ message: 'Token requerido' }, { status: 400 });

    const targetCodigo = await resolveQRToken(token);
    if (!targetCodigo) return NextResponse.json({ message: 'QR inválido o expirado' }, { status: 404 });

    const users = await getAllUsers();
    const namesByCodigo: Record<string, string[]> = {};
    for (const u of users) {
      if (!namesByCodigo[u.codigo]) namesByCodigo[u.codigo] = [];
      namesByCodigo[u.codigo].push(u.nombre);
    }
    const targetNames = namesByCodigo[targetCodigo] ?? [targetCodigo];

    if (!codigo) {
      return NextResponse.json({ targetNames, needsCodigo: true });
    }

    const [group, settings, card] = await Promise.all([
      findByCodigo(codigo),
      getBingoSettings(),
      getBingoCard(codigo),
    ]);

    if (!group) return NextResponse.json({ message: 'Código de invitado inválido' }, { status: 403 });
    if (!settings.enabled) return NextResponse.json({ message: 'El bingo está desactivado' }, { status: 403 });
    if (!card) return NextResponse.json({ message: 'Todavía no se generaron los cartones' }, { status: 404 });

    const cell = card.cells.find((c) => c.targetCodigo === targetCodigo);
    if (!cell) {
      return NextResponse.json({ message: 'Esta persona no está en tu cartón de bingo' }, { status: 404 });
    }

    return NextResponse.json({
      targetNames,
      position: cell.position,
      completedAt: cell.completedAt,
      mediaUrl: cell.mediaKey ? s3Url(cell.mediaKey) : null,
    });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
