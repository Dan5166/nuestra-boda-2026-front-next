import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from './dynamodb';

const TABLE_NAME = 'Admins';

export async function findAdmin(username: string) {
  const result = await dynamoClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { username },
    })
  );
  return result.Item ?? null;
}

export async function createAdmin(username: string, passwordHash: string) {
  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { username, passwordHash },
      ConditionExpression: 'attribute_not_exists(username)',
    })
  );
}
