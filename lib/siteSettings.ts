import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from './dynamodb';

// Reutiliza la misma tabla de configuraciones con un SK distinto
const TABLE_NAME = 'GallerySettings';
const PK = 'SETTINGS';
const SK = 'SITE';

export interface SiteSettings {
  homePage: 'landing' | 'menu' | 'postboda';
  showPostboda: boolean;
}

const DEFAULT_SETTINGS: SiteSettings = {
  homePage: 'landing',
  showPostboda: false,
};

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const result = await dynamoClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK },
      })
    );
    if (!result.Item) return DEFAULT_SETTINGS;
    return {
      homePage: result.Item.homePage ?? DEFAULT_SETTINGS.homePage,
      showPostboda: result.Item.showPostboda ?? DEFAULT_SETTINGS.showPostboda,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSiteSettings(settings: SiteSettings) {
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK, SK, ...settings },
    })
  );
}
