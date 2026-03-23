import {
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from './dynamodb';
import { EstadoUsuario, UpdateRsvpDto } from './types';

const TABLE_NAME = 'Users';
const RSVP_DEADLINE = new Date('2026-02-08T23:59:59-03:00');

export async function findByCodigo(codigo: string) {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `CODE#${codigo}`,
      },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return {
    codigo,
    usuarios: result.Items.map((item) => ({
      userId: item.userId,
      nombre: item.nombre,
      estado: item.estado,
    })),
  };
}

export async function findByUserId(userId: string) {
  const result = await dynamoClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId,
      },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  const user = result.Items[0];

  return {
    userId: user.userId,
    nombre: user.nombre,
    telefono: user.telefono ?? null,
    mail: user.mail ?? null,
    estado: user.estado,
    alergiaAlimentaria: user.alergiaAlimentaria,
    otrasAlergias: user.otrasAlergias ?? null,
    mensaje: user.mensaje ?? null,
    codigo: user.codigo,
  };
}

export async function updateRsvp(userId: string, dto: UpdateRsvpDto) {
  const user = await findByUserId(userId);

  if (!user) {
    return null;
  }

  return updateRsvpByCode(userId, user.codigo, dto, user.estado);
}

export async function updateRsvpByCode(
  userId: string,
  codigo: string,
  dto: UpdateRsvpDto,
  estado_anterior: string
) {
  const updateExpressions: string[] = [];
  const removeExpressions: string[] = [];
  const expressionValues: Record<string, any> = {};
  const expressionNames: Record<string, string> = {};

  const now = new Date().toISOString();

  if (dto.alergiaAlimentaria) {
    updateExpressions.push('#alergiaAlimentaria = :alergiaAlimentaria');
    expressionNames['#alergiaAlimentaria'] = 'alergiaAlimentaria';
    expressionValues[':alergiaAlimentaria'] = dto.alergiaAlimentaria;
  }

  if (dto.mail) {
    updateExpressions.push('#mail = :mail');
    expressionNames['#mail'] = 'mail';
    expressionValues[':mail'] = dto.mail;
  }

  if (dto.telefono) {
    updateExpressions.push('#telefono = :telefono');
    expressionNames['#telefono'] = 'telefono';
    expressionValues[':telefono'] = dto.telefono;
  }

  if (dto.mensaje) {
    updateExpressions.push('#mensaje = :mensaje');
    expressionNames['#mensaje'] = 'mensaje';
    expressionValues[':mensaje'] = dto.mensaje;
  }

  if (dto.otrasAlergias) {
    updateExpressions.push('#otrasAlergias = :otrasAlergias');
    expressionNames['#otrasAlergias'] = 'otrasAlergias';
    expressionValues[':otrasAlergias'] = dto.otrasAlergias;
  }

  if (dto.estado) {
    updateExpressions.push('#estado = :estado');
    expressionNames['#estado'] = 'estado';
    expressionValues[':estado'] = dto.estado;
  }

  if (dto.estado === 'confirmado' && estado_anterior === EstadoUsuario.PENDIENTE) {
    updateExpressions.push('#rsvpAt = :rsvpAt');
    expressionNames['#rsvpAt'] = 'rsvpAt';
    expressionValues[':rsvpAt'] = now;
  }

  if (dto.estado === 'pendiente' && estado_anterior === EstadoUsuario.PENDIENTE) {
    removeExpressions.push('#rsvpAt');
    expressionNames['#rsvpAt'] = 'rsvpAt';
  }

  updateExpressions.push('#updatedAt = :updatedAt');
  expressionNames['#updatedAt'] = 'updatedAt';
  expressionValues[':updatedAt'] = now;

  let UpdateExpression = '';
  if (updateExpressions.length) {
    UpdateExpression += `SET ${updateExpressions.join(', ')}`;
  }
  if (removeExpressions.length) {
    if (UpdateExpression) UpdateExpression += ' ';
    UpdateExpression += `REMOVE ${removeExpressions.join(', ')}`;
  }

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `CODE#${codigo}`,
      SK: `USER#${userId}`,
    },
    UpdateExpression,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  });

  const result = await dynamoClient.send(command);
  return result.Attributes;
}

export async function getSummaryByCodigo(codigo: string) {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `CODE#${codigo}`,
      },
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  const estados = result.Items.map((u) => u.estado);

  return {
    codigo,
    total: estados.length,
    confirmados: estados.filter((e) => e === 'confirmado').length,
    rechazados: estados.filter((e) => e === 'rechazado').length,
    pendientes: estados.filter((e) => e === 'pendiente').length,
    cerrado: new Date() > RSVP_DEADLINE,
  };
}
