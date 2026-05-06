import { NextResponse } from 'next/server';
import { getPublicUploadSettings } from '@/lib/gallery';

export async function GET() {
  try {
    const settings = await getPublicUploadSettings();
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
