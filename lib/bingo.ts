import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from './dynamodb';

const TABLE_NAME = 'GallerySettings';
const PK = 'BINGO';

export type GameStatus = 'waiting' | 'started' | 'ended';

export interface BingoGame {
  status: GameStatus;
  startedAt?: string;
  endedAt?: string;
  winnerCodigo?: string;
  winnerNames?: string[];
}

export interface BingoSubmission {
  codigo: string;
  names: string[];
  submittedAt: string;
  photoKeys: string[];
}

const DEFAULT_GAME: BingoGame = { status: 'waiting' };

export async function getGameState(): Promise<BingoGame> {
  try {
    const result = await dynamoClient.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK: 'GAME' } })
    );
    if (!result.Item) return DEFAULT_GAME;
    return {
      status: result.Item.status ?? 'waiting',
      startedAt: result.Item.startedAt,
      endedAt: result.Item.endedAt,
      winnerCodigo: result.Item.winnerCodigo,
      winnerNames: result.Item.winnerNames,
    };
  } catch {
    return DEFAULT_GAME;
  }
}

export async function saveGameState(game: BingoGame) {
  await dynamoClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: { PK, SK: 'GAME', ...game } })
  );
}

export async function saveSubmission(submission: BingoSubmission) {
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK, SK: `SUBMISSION#${submission.codigo}`, ...submission },
    })
  );
}

export async function getSubmission(codigo: string): Promise<BingoSubmission | null> {
  const result = await dynamoClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK: `SUBMISSION#${codigo}` } })
  );
  if (!result.Item) return null;
  return {
    codigo: result.Item.codigo,
    names: result.Item.names ?? [],
    submittedAt: result.Item.submittedAt,
    photoKeys: result.Item.photoKeys ?? [],
  };
}

export async function getAllSubmissions(since?: string): Promise<BingoSubmission[]> {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': PK, ':prefix': 'SUBMISSION#' },
    })
  );
  const all = (result.Items ?? []).map((item) => ({
    codigo: item.codigo,
    names: item.names ?? [],
    submittedAt: item.submittedAt,
    photoKeys: item.photoKeys ?? [],
  }));
  if (!since) return all;
  return all.filter((s) => new Date(s.submittedAt) >= new Date(since));
}

export async function isCurrentSessionSubmission(codigo: string, startedAt: string): Promise<boolean> {
  const sub = await getSubmission(codigo);
  if (!sub) return false;
  return new Date(sub.submittedAt) >= new Date(startedAt);
}

export async function determineWinner(since?: string): Promise<BingoSubmission | null> {
  const submissions = await getAllSubmissions(since);
  if (submissions.length === 0) return null;
  return submissions.sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  )[0];
}
