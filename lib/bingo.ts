import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from './dynamodb';
import crypto from 'crypto';

// Bingo settings stored in the existing GallerySettings table
const SETTINGS_TABLE = 'GallerySettings';
const SETTINGS_PK = 'SETTINGS';
const SETTINGS_SK = 'BINGO';

// Cards table: PK = codigo (String)
const CARDS_TABLE = 'BingoCards';

export interface BingoSettings {
  cols: number;    // grid side length (2 → 2x2=4, 3 → 3x3=9, 4 → 4x4=16)
  enabled: boolean;
  deletionLocked: boolean; // when true, guests cannot delete their own bingo photos
}

export interface BingoCell {
  position: number;
  targetCodigo: string;
  completedAt: string | null;
  mediaKey: string | null;
}

export interface BingoCard {
  codigo: string;
  cells: BingoCell[];
  createdAt: string;
  completedAt: string | null;
}

const DEFAULT_SETTINGS: BingoSettings = { cols: 3, enabled: false, deletionLocked: false };

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getBingoSettings(): Promise<BingoSettings> {
  try {
    const { Item } = await dynamoClient.send(
      new GetCommand({ TableName: SETTINGS_TABLE, Key: { PK: SETTINGS_PK, SK: SETTINGS_SK } })
    );
    if (!Item) return DEFAULT_SETTINGS;
    return {
      cols: Item.cols ?? DEFAULT_SETTINGS.cols,
      enabled: Item.enabled ?? DEFAULT_SETTINGS.enabled,
      deletionLocked: Item.deletionLocked ?? DEFAULT_SETTINGS.deletionLocked,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveBingoSettings(s: BingoSettings): Promise<void> {
  await dynamoClient.send(
    new PutCommand({ TableName: SETTINGS_TABLE, Item: { PK: SETTINGS_PK, SK: SETTINGS_SK, ...s } })
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────────

export async function getBingoCard(codigo: string): Promise<BingoCard | null> {
  const { Item } = await dynamoClient.send(
    new GetCommand({ TableName: CARDS_TABLE, Key: { codigo } })
  );
  return Item ? (Item as BingoCard) : null;
}

export async function getAllBingoCards(): Promise<BingoCard[]> {
  const { Items } = await dynamoClient.send(new ScanCommand({ TableName: CARDS_TABLE }));
  return (Items ?? []) as BingoCard[];
}

export async function saveBingoCard(card: BingoCard): Promise<void> {
  await dynamoClient.send(new PutCommand({ TableName: CARDS_TABLE, Item: card }));
}

export async function completeBingoCell(
  codigo: string,
  position: number,
  mediaKey: string
): Promise<BingoCard | null> {
  const card = await getBingoCard(codigo);
  if (!card) return null;

  const now = new Date().toISOString();
  const cells = card.cells.map((c) =>
    c.position === position ? { ...c, completedAt: now, mediaKey } : c
  );
  const allDone = cells.every((c) => c.completedAt !== null);
  const updated: BingoCard = {
    ...card,
    cells,
    completedAt: allDone && !card.completedAt ? now : card.completedAt,
  };
  await saveBingoCard(updated);
  return updated;
}

/**
 * Clear a completed cell, returning the old mediaKey (so the caller can delete from S3/DynamoDB).
 */
export async function resetBingoCell(
  codigo: string,
  position: number
): Promise<string | null> {
  const card = await getBingoCard(codigo);
  if (!card) return null;
  const cell = card.cells.find((c) => c.position === position);
  if (!cell) return null;
  const oldKey = cell.mediaKey;
  const cells = card.cells.map((c) =>
    c.position === position ? { ...c, completedAt: null, mediaKey: null } : c
  );
  await saveBingoCard({ ...card, cells, completedAt: null });
  return oldKey;
}

// ── QR Tokens ────────────────────────────────────────────────────────────────
// tokens: { [token]: targetCodigo } — stored alongside bingo settings

const QR_TOKENS_SK = 'BINGO_QR_TOKENS';

export async function getQRTokens(): Promise<Record<string, string>> {
  try {
    const { Item } = await dynamoClient.send(
      new GetCommand({ TableName: SETTINGS_TABLE, Key: { PK: SETTINGS_PK, SK: QR_TOKENS_SK } })
    );
    return (Item?.tokens ?? {}) as Record<string, string>;
  } catch {
    return {};
  }
}

export async function saveQRTokens(tokens: Record<string, string>): Promise<void> {
  await dynamoClient.send(
    new PutCommand({ TableName: SETTINGS_TABLE, Item: { PK: SETTINGS_PK, SK: QR_TOKENS_SK, tokens } })
  );
}

export async function resolveQRToken(token: string): Promise<string | null> {
  const tokens = await getQRTokens();
  return tokens[token] ?? null;
}

/**
 * Generates one opaque token per unique targetCodigo found across all cards.
 * Tokens are short (8 hex chars), not guessable, and stored in DynamoDB.
 */
export async function generateQRTokens(targetCodigos: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(targetCodigos)];
  const tokens: Record<string, string> = {};
  for (const code of unique) {
    const token = crypto.randomBytes(4).toString('hex').toUpperCase();
    tokens[token] = code;
  }
  await saveQRTokens(tokens);
  return tokens;
}

// ── Overrides ────────────────────────────────────────────────────────────────

export async function overrideBingoCell(
  codigo: string,
  position: number,
  newTargetCodigo: string
): Promise<void> {
  const card = await getBingoCard(codigo);
  if (!card) return;
  const cells = card.cells.map((c) =>
    c.position === position
      ? { ...c, targetCodigo: newTargetCodigo, completedAt: null, mediaKey: null }
      : c
  );
  const allDone = cells.every((c) => c.completedAt !== null);
  await saveBingoCard({ ...card, cells, completedAt: allDone ? card.completedAt : null });
}

/**
 * Generate cards for all provided codes using circular assignment,
 * which guarantees every code appears as a target in at least one card.
 *
 * Circle: code[i] is assigned code[(i+1)%N], code[(i+2)%N], ..., code[(i+G)%N]
 */
export async function generateBingoCards(
  codes: string[],
  cols: number
): Promise<{ generated: number; warning?: string }> {
  if (codes.length === 0) return { generated: 0, warning: 'No hay códigos disponibles' };

  const gridSize = cols * cols;
  const shuffled = [...codes].sort(() => Math.random() - 0.5);
  const N = shuffled.length;
  const now = new Date().toISOString();

  const warning = N <= gridSize
    ? `Solo hay ${N} códigos para ${gridSize} casillas. Habrá asignaciones repetidas.`
    : undefined;

  const cards: BingoCard[] = shuffled.map((codigo, i) => ({
    codigo,
    cells: Array.from({ length: gridSize }, (_, j) => ({
      position: j,
      targetCodigo: shuffled[(i + 1 + j) % N],
      completedAt: null,
      mediaKey: null,
    })),
    createdAt: now,
    completedAt: null,
  }));

  await Promise.all(cards.map(saveBingoCard));
  return { generated: cards.length, warning };
}
