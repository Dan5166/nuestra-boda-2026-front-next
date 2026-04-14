import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from './dynamodb';
import { randomUUID } from 'crypto';

const TABLE_NAME = 'PlaylistSongs';

export interface Song {
  PK: string;        // SONG#<songId>
  SK: string;        // SONG#<songId>
  songId: string;
  title: string;
  artist: string;
  category: string;
  subcategory: string | null;
  durationSecs: number;
  votes: number;
  votedBy: string[];
  notes: string | null;
  youtubeUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateSongInput = {
  title: string;
  artist: string;
  category: string;
  subcategory?: string | null;
  durationSecs?: number;
  notes?: string | null;
  youtubeUrl?: string | null;
};

export type UpdateSongInput = Partial<CreateSongInput>;

// ── YouTube duration ────────────────────────────────────────────────────────

function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

export async function fetchYoutubeDuration(url: string): Promise<number> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return 0;

  const videoId = extractYoutubeId(url);
  if (!videoId) return 0;

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${apiKey}`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const duration = data.items?.[0]?.contentDetails?.duration;
    return duration ? parseIsoDuration(duration) : 0;
  } catch {
    return 0;
  }
}

export async function getAllSongs(): Promise<Song[]> {
  const result = await dynamoClient.send(
    new ScanCommand({ TableName: TABLE_NAME })
  );
  return (result.Items ?? []) as Song[];
}

export async function getSong(songId: string): Promise<Song | null> {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${songId}`, SK: `SONG#${songId}` },
    })
  );
  return (result.Item as Song) ?? null;
}

export async function createSong(input: CreateSongInput): Promise<Song> {
  const songId = randomUUID();
  const now = new Date().toISOString();
  const song: Song = {
    PK: `SONG#${songId}`,
    SK: `SONG#${songId}`,
    songId,
    title: input.title.trim(),
    artist: input.artist.trim(),
    category: input.category,
    subcategory: input.subcategory?.trim() || null,
    durationSecs: input.durationSecs ?? 0,
    votes: 0,
    votedBy: [],
    notes: input.notes?.trim() || null,
    youtubeUrl: input.youtubeUrl?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  await dynamoClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: song })
  );
  return song;
}

export async function updateSong(songId: string, input: UpdateSongInput): Promise<Song | null> {
  const existing = await getSong(songId);
  if (!existing) return null;

  const updated: Song = {
    ...existing,
    title: input.title?.trim() ?? existing.title,
    artist: input.artist?.trim() ?? existing.artist,
    category: input.category ?? existing.category,
    subcategory: input.subcategory !== undefined ? (input.subcategory?.trim() || null) : existing.subcategory,
    durationSecs: input.durationSecs ?? existing.durationSecs,
    notes: input.notes !== undefined ? (input.notes?.trim() || null) : existing.notes,
    youtubeUrl: input.youtubeUrl !== undefined ? (input.youtubeUrl?.trim() || null) : existing.youtubeUrl,
    updatedAt: new Date().toISOString(),
  };

  await dynamoClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: updated })
  );
  return updated;
}

export async function deleteSong(songId: string): Promise<void> {
  await dynamoClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `SONG#${songId}`, SK: `SONG#${songId}` },
    })
  );
}

export async function toggleVote(songId: string, username: string): Promise<Song | null> {
  const existing = await getSong(songId);
  if (!existing) return null;

  const votedBy = existing.votedBy ?? [];
  const alreadyVoted = votedBy.includes(username);
  const newVotedBy = alreadyVoted
    ? votedBy.filter((u) => u !== username)
    : [...votedBy, username];

  const updated: Song = {
    ...existing,
    votedBy: newVotedBy,
    votes: newVotedBy.length,
    updatedAt: new Date().toISOString(),
  };

  await dynamoClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: updated })
  );
  return updated;
}
