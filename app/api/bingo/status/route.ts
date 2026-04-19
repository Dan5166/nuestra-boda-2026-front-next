import { NextResponse } from 'next/server';
import { getGameState } from '@/lib/bingo';

export async function GET() {
  try {
    const game = await getGameState();
    return NextResponse.json(game);
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
