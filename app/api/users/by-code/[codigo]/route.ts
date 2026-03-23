import { findByCodigo } from '@/lib/users';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;

  try {
    const data = await findByCodigo(codigo.toUpperCase());

    if (!data) {
      return Response.json(
        { message: 'Código de invitación no válido' },
        { status: 404 }
      );
    }

    return Response.json(data);
  } catch {
    return Response.json({ message: 'Error interno' }, { status: 500 });
  }
}
