import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from './dynamodb';

const TABLE_NAME = 'GallerySettings';
const PK = 'SETTINGS';
const SK = 'GALLERY';

export interface GallerySettings {
  maxPhotosPerCode: number;
  maxVideosPerCode: number;
  maxFileSizeMB: number;
  enabled: boolean;
  deletionLocked: boolean;
}

const DEFAULT_SETTINGS: GallerySettings = {
  maxPhotosPerCode: 10,
  maxVideosPerCode: 2,
  maxFileSizeMB: 50,
  enabled: true,
  deletionLocked: false,
};

export async function getGallerySettings(): Promise<GallerySettings> {
  try {
    const result = await dynamoClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK },
      })
    );
    if (!result.Item) return DEFAULT_SETTINGS;
    return {
      maxPhotosPerCode: result.Item.maxPhotosPerCode ?? DEFAULT_SETTINGS.maxPhotosPerCode,
      maxVideosPerCode: result.Item.maxVideosPerCode ?? DEFAULT_SETTINGS.maxVideosPerCode,
      maxFileSizeMB: result.Item.maxFileSizeMB ?? DEFAULT_SETTINGS.maxFileSizeMB,
      enabled: result.Item.enabled ?? DEFAULT_SETTINGS.enabled,
      deletionLocked: result.Item.deletionLocked ?? DEFAULT_SETTINGS.deletionLocked,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveGallerySettings(settings: GallerySettings) {
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK, SK, ...settings },
    })
  );
}

// ── GalleryMedia ────────────────────────────────────────────────────────────
// Table: GalleryMedia  |  PK: s3Key (String)

const MEDIA_TABLE = 'GalleryMedia';

export interface MediaMetadata {
  s3Key: string;
  uploadedBy: string;       // invitation code that uploaded this file
  involvedCodes: string[];  // other codes tagged in this file
  uploadedAt: string;
  size: number;
}

export async function saveMediaMetadata(meta: MediaMetadata) {
  await dynamoClient.send(
    new PutCommand({ TableName: MEDIA_TABLE, Item: meta })
  );
}

/** Returns all files uploaded by this code OR where this code is tagged. */
export async function getMediaForCode(codigo: string): Promise<MediaMetadata[]> {
  const result = await dynamoClient.send(
    new ScanCommand({
      TableName: MEDIA_TABLE,
      FilterExpression: 'uploadedBy = :c OR contains(involvedCodes, :c)',
      ExpressionAttributeValues: { ':c': codigo },
    })
  );
  return (result.Items ?? []) as MediaMetadata[];
}

export async function getAllMedia(): Promise<MediaMetadata[]> {
  const result = await dynamoClient.send(new ScanCommand({ TableName: MEDIA_TABLE }));
  return (result.Items ?? []) as MediaMetadata[];
}

export async function deleteMediaMetadata(s3Key: string) {
  await dynamoClient.send(
    new DeleteCommand({ TableName: MEDIA_TABLE, Key: { s3Key } })
  );
}
