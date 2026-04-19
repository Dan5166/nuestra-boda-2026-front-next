import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/dynamodb';

const TABLE = 'GallerySettings';
const PK = 'SETTINGS';
const SK = 'RANDOM';

async function authed(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return !!token && !!(await verifyJwt(token));
}

export async function GET() {
  if (!(await authed()))
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });

  try {
    const result = await dynamoClient.send(
      new GetCommand({ TableName: TABLE, Key: { PK, SK } })
    );
    const participants: string[] = result.Item?.participants ?? [];
    return NextResponse.json({ participants });
  } catch {
    return NextResponse.json({ participants: [] });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await authed()))
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });

  const { participants } = await req.json();
  if (!Array.isArray(participants))
    return NextResponse.json({ message: 'Formato inválido' }, { status: 400 });

  await dynamoClient.send(
    new PutCommand({ TableName: TABLE, Item: { PK, SK, participants } })
  );
  return NextResponse.json({ ok: true });
}
