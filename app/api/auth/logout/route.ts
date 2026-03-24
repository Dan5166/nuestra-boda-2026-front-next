import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST(req: Request) {
  const response = NextResponse.redirect(new URL('/', req.url));
  response.cookies.delete(COOKIE_NAME);
  return response;
}
