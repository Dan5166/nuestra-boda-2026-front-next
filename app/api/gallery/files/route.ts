import { NextRequest, NextResponse } from 'next/server';
import { listUploadsByCodigo } from '@/lib/s3';
import { findByCodigo } from '@/lib/users';
import { getGallerySettings, getMediaForCode } from '@/lib/gallery';

const BUCKET = process.env.AWS_S3_BUCKET!;
const REGION = process.env.AWS_REGION!;

function s3Url(key: string) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get('codigo');

  if (!codigo) {
    return NextResponse.json({ message: 'Falta el código' }, { status: 400 });
  }

  const group = await findByCodigo(codigo);
  if (!group) {
    return NextResponse.json({ message: 'Código inválido' }, { status: 403 });
  }

  const [s3Files, metaRecords, settings] = await Promise.all([
    listUploadsByCodigo(codigo),
    getMediaForCode(codigo),
    getGallerySettings(),
  ]);

  // Build a map of s3Key -> metadata for quick lookup
  const metaByKey = new Map(metaRecords.map((m) => [m.s3Key, m]));

  // Files uploaded by this code (from S3, source of truth for existence)
  const ownFiles = s3Files.map((f) => {
    const meta = metaByKey.get(f.key);
    return {
      key: f.key,
      url: f.url,
      size: meta?.size ?? f.size,
      lastModified: f.lastModified,
      uploadedBy: codigo,
      involvedCodes: meta?.involvedCodes ?? [],
      isOwn: true,
    };
  });

  // Files from other codes where this code is tagged (involvedCodes contains this codigo)
  const involvedFiles = metaRecords
    .filter((m) => m.uploadedBy !== codigo && m.involvedCodes.includes(codigo))
    .map((m) => ({
      key: m.s3Key,
      url: s3Url(m.s3Key),
      size: m.size,
      lastModified: m.uploadedAt,
      uploadedBy: m.uploadedBy,
      involvedCodes: m.involvedCodes,
      isOwn: false,
    }));

  return NextResponse.json({
    files: [...ownFiles, ...involvedFiles],
    settings,
  });
}
