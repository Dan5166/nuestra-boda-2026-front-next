import { NextResponse } from 'next/server';
import { findAdmin } from '@/lib/admins';
import { verifyPassword, signJwt, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Faltan credenciales' }, { status: 400 });
    }

    const admin = await findAdmin(username);

    const passwordOk = admin && (await verifyPassword(password, admin.passwordHash));

    if (!passwordOk) {
      // Delay para dificultar fuerza bruta
      await new Promise((r) => setTimeout(r, 1500));
      return NextResponse.json({ message: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const token = await signJwt(username);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 horas
    });

    return response;
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
