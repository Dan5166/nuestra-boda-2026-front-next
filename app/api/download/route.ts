import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '@/lib/s3';

const BUCKET = process.env.AWS_S3_BUCKET!;

const ALLOWED_PREFIXES = ['bingo/', 'uploads/', 'gallery/'];

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');

  if (!key) return NextResponse.json({ message: 'Falta el parámetro key' }, { status: 400 });

  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return NextResponse.json({ message: 'No permitido' }, { status: 403 });
  }

  // Extract a clean filename from the S3 key
  // Key format: bingo/{codigo}/{position}/{timestamp}-{original_name}
  const rawFilename = key.split('/').pop() ?? 'foto';
  const filename = rawFilename.replace(/^\d+-/, ''); // strip leading timestamp

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });

  return NextResponse.redirect(url);
}
