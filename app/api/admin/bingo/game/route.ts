import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import {
  getGameState,
  saveGameState,
  getAllSubmissions,
  determineWinner,
} from '@/lib/bingo';

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
    const game = await getGameState();
    const submissions = await getAllSubmissions(game.startedAt);
    const sorted = submissions.sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );
    return NextResponse.json({ game, submissions: sorted });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }
  try {
    const { action } = await req.json() as { action: 'start' | 'end' | 'reset' };
    const current = await getGameState();

    if (action === 'start') {
      if (current.status === 'started') {
        return NextResponse.json({ message: 'El juego ya está en curso' }, { status: 400 });
      }
      await saveGameState({ status: 'started', startedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true, status: 'started' });
    }

    if (action === 'end') {
      if (current.status !== 'started') {
        return NextResponse.json({ message: 'El juego no está en curso' }, { status: 400 });
      }
      const winner = await determineWinner(current.startedAt);
      const updatedGame = {
        status: 'ended' as const,
        startedAt: current.startedAt,
        endedAt: new Date().toISOString(),
        winnerCodigo: winner?.codigo,
        winnerNames: winner?.names,
      };
      await saveGameState(updatedGame);
      return NextResponse.json({ ok: true, status: 'ended', winner });
    }

    if (action === 'reset') {
      await saveGameState({ status: 'waiting' });
      return NextResponse.json({ ok: true, status: 'waiting' });
    }

    return NextResponse.json({ message: 'Acción inválida' }, { status: 400 });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
