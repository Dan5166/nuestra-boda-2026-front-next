/**
 * Crea un usuario admin en DynamoDB.
 * Uso: npx tsx scripts/seed-admin.ts <username> <password>
 *
 * Requiere las variables de entorno AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * en el archivo .env.local
 */

import 'dotenv/config';
import { hashPassword } from '../lib/auth';
import { createAdmin } from '../lib/admins';

async function main() {
  const [username, password] = process.argv.slice(2);

  if (!username || !password) {
    console.log(process.argv.slice(2));
    console.error('Uso: npx tsx scripts/seed-admin.ts <username> <password>');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await createAdmin(username, passwordHash);

  console.log(`✓ Admin "${username}" creado exitosamente.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
