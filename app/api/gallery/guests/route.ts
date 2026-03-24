import { NextResponse } from 'next/server';
import { getAllUsers } from '@/lib/users';

// Returns confirmed guests grouped by invitation code.
// Only exposes names and codes — no contact info.
export async function GET() {
  try {
    const users = await getAllUsers();

    const byCodigo = new Map<string, string[]>();
    for (const user of users) {
      if (user.estado !== 'confirmado') continue;
      if (!byCodigo.has(user.codigo)) byCodigo.set(user.codigo, []);
      byCodigo.get(user.codigo)!.push(user.nombre);
    }

    const groups = Array.from(byCodigo.entries()).map(([codigo, nombres]) => ({
      codigo,
      nombres,
      label: nombres.join(' & '),
    }));

    return NextResponse.json({ groups });
  } catch {
    return NextResponse.json({ message: 'Error interno' }, { status: 500 });
  }
}
