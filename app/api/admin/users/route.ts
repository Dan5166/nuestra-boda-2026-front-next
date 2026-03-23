import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt, COOKIE_NAME } from '@/lib/auth';
import { getAllUsers } from '@/lib/users';

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token || !(await verifyJwt(token))) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
