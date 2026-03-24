import { NextRequest, NextResponse } from 'next/server';
import { findByCodigo } from '@/lib/users';
import { saveMediaMetadata } from '@/lib/gallery';

export async function POST(req: NextRequest) {
  try {
    const { codigo, key, involvedCodes, size } = await req.json();

    if (!codigo || !key) {
      return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Verify the code exists
    const group = await findByCodigo(codigo);
    if (!group) {
      return NextResponse.json({ message: 'Código inválido' }, { status: 403 });
    }

    // Security: the key must belong to this code's upload prefix
    if (!key.startsWith(`uploads/${codigo}/`)) {
      return NextResponse.json({ message: 'Clave no permitida' }, { status: 403 });
    }

    const sanitizedCodes: string[] = Array.isArray(involvedCodes)
      ? involvedCodes.filter((c: unknown) => typeof c === 'string' && c.trim()).map((c: string) => c.toUpperCase().trim())
      : [];

    await saveMediaMetadata({
      s3Key: key,
      uploadedBy: codigo,
      involvedCodes: sanitizedCodes,
      uploadedAt: new Date().toISOString(),
      size: typeof size === 'number' ? size : 0,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
