import { updateRsvp } from '@/lib/users';
import { UpdateRsvpDto } from '@/lib/types';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  let dto: UpdateRsvpDto;
  try {
    dto = await request.json();
  } catch {
    return Response.json({ message: 'Body inválido' }, { status: 400 });
  }

  if (!dto.telefono || !dto.estado) {
    return Response.json(
      { message: 'telefono y estado son requeridos' },
      { status: 400 }
    );
  }

  try {
    const result = await updateRsvp(userId, dto);

    if (!result) {
      return Response.json(
        { message: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    return Response.json(result);
  } catch {
    return Response.json({ message: 'Error interno' }, { status: 500 });
  }
}
