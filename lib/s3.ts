import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import https from 'https';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const BUCKET = process.env.AWS_S3_BUCKET!;
const REGION = process.env.AWS_REGION!;

export const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  ...(process.env.NODE_ENV !== 'production' && {
    requestHandler: new NodeHttpHandler({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
  }),
});

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300
) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function listUploadsByCodigo(codigo: string) {
  const prefix = `uploads/${codigo}/`;
  const result = await s3Client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  return (result.Contents ?? []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size ?? 0,
    lastModified: obj.LastModified?.toISOString() ?? null,
    url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${obj.Key}`,
  }));
}

export async function listAllUploads() {
  const prefix = `uploads/`;
  const result = await s3Client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  return (result.Contents ?? []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size ?? 0,
    lastModified: obj.LastModified?.toISOString() ?? null,
    url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${obj.Key}`,
    // key format: uploads/{codigo}/{filename}
    codigo: obj.Key!.split('/')[1] ?? '',
  }));
}

export async function deleteUpload(key: string) {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
