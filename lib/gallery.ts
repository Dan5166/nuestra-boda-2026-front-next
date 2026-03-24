import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from './dynamodb';

const TABLE_NAME = 'GallerySettings';
const PK = 'SETTINGS';
const SK = 'GALLERY';

export interface GallerySettings {
  maxPhotosPerCode: number;
  maxVideosPerCode: number;
  maxFileSizeMB: number;
  enabled: boolean;
}

const DEFAULT_SETTINGS: GallerySettings = {
  maxPhotosPerCode: 10,
  maxVideosPerCode: 2,
  maxFileSizeMB: 50,
  enabled: true,
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
