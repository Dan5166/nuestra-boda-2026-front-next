import { NextResponse } from 'next/server';
import { getAllMedia, getGallerySettings } from '@/lib/gallery';
import { getAllUsers } from '@/lib/users';
import { listAllUploads } from '@/lib/s3';

export async function GET() {
  const [s3Files, allMedia, settings, users] = await Promise.all([
    listAllUploads(),
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

  const metaByKey = new Map(allMedia.map((m) => [m.s3Key, m]));

  const files = s3Files
    .sort((a, b) => (b.lastModified ?? '') > (a.lastModified ?? '') ? 1 : -1)
    .map((f) => {
      const meta = metaByKey.get(f.key);
      let uploaderLabel: string;
      if (f.codigo === 'publico') {
        uploaderLabel = meta?.uploaderName ?? 'Invitado';
      } else {
        const names = namesByCodigo[f.codigo];
        uploaderLabel = names?.join(' & ') ?? f.codigo;
      }
      return {
        key: f.key,
        url: f.url,
        size: f.size,
        uploadedAt: f.lastModified,
        uploaderLabel,
      };
    });

  return NextResponse.json({ enabled: true, files });
}
