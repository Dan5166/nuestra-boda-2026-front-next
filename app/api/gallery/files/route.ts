import { NextRequest, NextResponse } from 'next/server';
import { listUploadsByCodigo } from '@/lib/s3';
import { findByCodigo } from '@/lib/users';
import { getGallerySettings } from '@/lib/gallery';

export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get('codigo');

  if (!codigo) {
    return NextResponse.json({ message: 'Falta el código' }, { status: 400 });
  }

  const group = await findByCodigo(codigo);
  if (!group) {
    return NextResponse.json({ message: 'Código inválido' }, { status: 403 });
  }

  const [files, settings] = await Promise.all([
    listUploadsByCodigo(codigo),
    getGallerySettings(),
  ]);

  return NextResponse.json({ files, settings });
}
