import { NextResponse } from 'next/server';
import { getAllMedia, getGallerySettings, getGalleryOrder } from '@/lib/gallery';
import { getAllUsers } from '@/lib/users';
import { listAllUploads } from '@/lib/s3';

export async function GET() {
  const [s3Files, allMedia, settings, users, order] = await Promise.all([
    listAllUploads(),
    getAllMedia(),
    getGallerySettings(),
    getAllUsers(),
    getGalleryOrder(),
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

  const orderMap = new Map(order.map((k, i) => [k, i]));

  const files = s3Files
    .filter((f) => {
      const meta = metaByKey.get(f.key);
      return meta === undefined || meta.showInGallery !== false;
    })
    .sort((a, b) => {
      const ia = orderMap.get(a.key) ?? Infinity;
      const ib = orderMap.get(b.key) ?? Infinity;
      if (ia === ib) return (b.lastModified ?? '') > (a.lastModified ?? '') ? 1 : -1;
      return ia - ib;
    })
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
