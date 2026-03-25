import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { getAllBingoCards, generateQRTokens, getQRTokens } from '@/lib/bingo';
import { getAllUsers } from '@/lib/users';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyJwt(token) : null;
}

async function buildEnriched(tokens: Record<string, string>) {
  const users = await getAllUsers();
  const namesByCodigo: Record<string, string[]> = {};
  for (const u of users) {
    if (!namesByCodigo[u.codigo]) namesByCodigo[u.codigo] = [];
    namesByCodigo[u.codigo].push(u.nombre);
  }
  return Object.entries(tokens).map(([token, targetCodigo]) => ({
    token,
    targetCodigo,
    targetNames: namesByCodigo[targetCodigo] ?? [targetCodigo],
  }));
}

// GET: return existing tokens with enriched names
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  const tokens = await getQRTokens();
  return NextResponse.json({ tokens: await buildEnriched(tokens) });
}

// POST: (re)generate tokens from all current bingo cards
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });

  const cards = await getAllBingoCards();
  if (cards.length === 0) {
    return NextResponse.json({ message: 'Primero genera los cartones de bingo' }, { status: 400 });
  }

  const allTargets = cards.flatMap((c) => c.cells.map((cell) => cell.targetCodigo));
  const tokens = await generateQRTokens(allTargets);

  return NextResponse.json({ tokens: await buildEnriched(tokens) });
}
