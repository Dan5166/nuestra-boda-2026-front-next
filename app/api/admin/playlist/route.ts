import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { getAllSongs, createSong, updateSong, deleteSong } from '@/lib/playlist';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? verifyJwt(token) : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const songs = await getAllSongs();
    return NextResponse.json({ songs });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.title?.trim() || !body.artist?.trim() || !body.category?.trim()) {
      return NextResponse.json({ message: 'Título, artista y categoría son obligatorios' }, { status: 400 });
    }

    const song = await createSong({
      title: body.title,
      artist: body.artist,
      category: body.category,
      subcategory: body.subcategory || null,
      notes: body.notes || null,
      youtubeUrl: body.youtubeUrl || null,
    });

    return NextResponse.json({ song }, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.songId) {
      return NextResponse.json({ message: 'Falta songId' }, { status: 400 });
    }

    const song = await updateSong(body.songId, {
      title: body.title,
      artist: body.artist,
      category: body.category,
      subcategory: body.subcategory,
      notes: body.notes,
      youtubeUrl: body.youtubeUrl,
    });

    if (!song) {
      return NextResponse.json({ message: 'Canción no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ song });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const { songId } = await req.json();
    if (!songId) {
      return NextResponse.json({ message: 'Falta songId' }, { status: 400 });
    }

    await deleteSong(songId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
