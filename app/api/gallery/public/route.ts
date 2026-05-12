import { NextResponse } from 'next/server';
import { getAllMedia, getGallerySettings } from '@/lib/gallery';
import { getAllUsers } from '@/lib/users';

const BUCKET = process.env.AWS_S3_BUCKET!;
const REGION = process.env.AWS_REGION!;

function s3Url(key: string) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

export async function GET() {
  const [allMedia, settings, users] = await Promise.all([
    getAllMedia(),
    getGallerySettings(),
    getAllUsers(),
  ]);

  if (!settings.enabled) {
    return NextResponse.json({ enabled: false, files: [] });
  }

  const namesByCodigo: Record<string, string[]> = {};
  for (const user of users) {
    if (!namesByCodigo[user.codigo]) namesByCodigo[user.codigo] = [];
    namesByCodigo[user.codigo].push(user.nombre);
  }

  const files = allMedia
    .sort((a, b) => (b.uploadedAt > a.uploadedAt ? 1 : -1))
    .map((m) => {
      let uploaderLabel: string;
      if (m.uploadedBy === 'publico') {
        uploaderLabel = m.uploaderName ?? 'Invitado';
      } else {
        const names = namesByCodigo[m.uploadedBy];
        uploaderLabel = names?.join(' & ') ?? m.uploadedBy;
      }
      return {
        key: m.s3Key,
        url: s3Url(m.s3Key),
        size: m.size,
        uploadedAt: m.uploadedAt,
        uploaderLabel,
      };
    });

  return NextResponse.json({ enabled: true, files });
}
