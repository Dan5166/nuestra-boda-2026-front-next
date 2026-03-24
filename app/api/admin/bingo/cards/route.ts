import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { getAllUsers } from '@/lib/users';
import { getAllBingoCards } from '@/lib/bingo';

const REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_S3_BUCKET!;

function s3Url(key: string) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyJwt(token) : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });

  try {
    const [cards, users] = await Promise.all([getAllBingoCards(), getAllUsers()]);

    const namesByCodigo: Record<string, string[]> = {};
    for (const u of users) {
      if (!namesByCodigo[u.codigo]) namesByCodigo[u.codigo] = [];
      namesByCodigo[u.codigo].push(u.nombre);
    }

    const enriched = cards.map((card) => ({
      ...card,
      ownerNames: namesByCodigo[card.codigo] ?? [card.codigo],
      completedCells: card.cells.filter((c) => c.completedAt !== null).length,
      totalCells: card.cells.length,
      cells: card.cells.map((c) => ({
        ...c,
        targetNames: namesByCodigo[c.targetCodigo] ?? [c.targetCodigo],
        mediaUrl: c.mediaKey ? s3Url(c.mediaKey) : null,
      })),
    }));

    // Sort: completed first (by completedAt), then by progress desc
    enriched.sort((a, b) => {
      if (a.completedAt && b.completedAt) return a.completedAt.localeCompare(b.completedAt);
      if (a.completedAt) return -1;
      if (b.completedAt) return 1;
      return b.completedCells - a.completedCells;
    });

    return NextResponse.json({ cards: enriched });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
