import { NextRequest, NextResponse } from 'next/server';
import { findByCodigo } from '@/lib/users';
import { resetBingoCell } from '@/lib/bingo';
import { deleteUpload } from '@/lib/s3';
import { deleteMediaMetadata } from '@/lib/gallery';

export async function DELETE(req: NextRequest) {
  try {
    const { codigo, position } = await req.json();

    if (!codigo || position === undefined) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    const group = await findByCodigo(codigo);
    if (!group) return NextResponse.json({ message: 'Código inválido' }, { status: 403 });

    const oldKey = await resetBingoCell(codigo, Number(position));
    if (oldKey) {
      await Promise.all([deleteUpload(oldKey), deleteMediaMetadata(oldKey)]);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
