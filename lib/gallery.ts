import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
  uploadedBy: string;       // invitation code that uploaded this file, or "publico"
  involvedCodes: string[];  // other codes tagged in this file
  uploadedAt: string;
  size: number;
  uploaderName?: string;    // optional display name for public uploads
  showInGallery?: boolean;  // undefined = true (visible by default)
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

// ── Gallery order ────────────────────────────────────────────────────────────

const ORDER_SK = 'GALLERY_ORDER';

export async function getGalleryOrder(): Promise<string[]> {
  try {
    const result = await dynamoClient.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK: ORDER_SK } })
    );
    return (result.Item?.order as string[]) ?? [];
  } catch {
    return [];
  }
}

export async function saveGalleryOrder(order: string[]) {
  await dynamoClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: { PK, SK: ORDER_SK, order } })
  );
}

export async function updateMediaVisibility(s3Key: string, showInGallery: boolean) {
  await dynamoClient.send(
    new UpdateCommand({
      TableName: MEDIA_TABLE,
      Key: { s3Key },
      UpdateExpression: 'SET showInGallery = :v',
      ExpressionAttributeValues: { ':v': showInGallery },
    })
  );
}

export async function deleteMediaMetadata(s3Key: string) {
  await dynamoClient.send(
    new DeleteCommand({ TableName: MEDIA_TABLE, Key: { s3Key } })
  );
}

// ── Public Upload Settings ───────────────────────────────────────────────────
// Stored in same GallerySettings table with SK: PUBLIC_UPLOAD

const PUBLIC_SK = 'PUBLIC_UPLOAD';

export interface PublicUploadSettings {
  enabled: boolean;
  maxFileSizeMBPhoto: number;
  maxFileSizeMBVideo: number;
  maxPhotosPerSession: number;
  maxVideosPerSession: number;
  maxPhotosTotal: number;
  maxVideosTotal: number;
}

const DEFAULT_PUBLIC_SETTINGS: PublicUploadSettings = {
  enabled: true,
  maxFileSizeMBPhoto: 15,
  maxFileSizeMBVideo: 150,
  maxPhotosPerSession: 10,
  maxVideosPerSession: 2,
  maxPhotosTotal: 300,
  maxVideosTotal: 60,
};

export async function getPublicUploadSettings(): Promise<PublicUploadSettings> {
  try {
    const result = await dynamoClient.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK: PUBLIC_SK } })
    );
    if (!result.Item) return DEFAULT_PUBLIC_SETTINGS;
    return {
      enabled: result.Item.enabled ?? DEFAULT_PUBLIC_SETTINGS.enabled,
      maxFileSizeMBPhoto: result.Item.maxFileSizeMBPhoto ?? DEFAULT_PUBLIC_SETTINGS.maxFileSizeMBPhoto,
      maxFileSizeMBVideo: result.Item.maxFileSizeMBVideo ?? DEFAULT_PUBLIC_SETTINGS.maxFileSizeMBVideo,
      maxPhotosPerSession: result.Item.maxPhotosPerSession ?? DEFAULT_PUBLIC_SETTINGS.maxPhotosPerSession,
      maxVideosPerSession: result.Item.maxVideosPerSession ?? DEFAULT_PUBLIC_SETTINGS.maxVideosPerSession,
      maxPhotosTotal: result.Item.maxPhotosTotal ?? DEFAULT_PUBLIC_SETTINGS.maxPhotosTotal,
      maxVideosTotal: result.Item.maxVideosTotal ?? DEFAULT_PUBLIC_SETTINGS.maxVideosTotal,
    };
  } catch {
    return DEFAULT_PUBLIC_SETTINGS;
  }
}

export async function savePublicUploadSettings(settings: PublicUploadSettings) {
  await dynamoClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: { PK, SK: PUBLIC_SK, ...settings } })
  );
}
