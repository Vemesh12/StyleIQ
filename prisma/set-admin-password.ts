import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

// Sets (or creates) an admin account's password.
//
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-secret' npm run admin:set-password
//
// ADMIN_EMAIL / ADMIN_PASSWORD can also live in .env. Without ADMIN_PASSWORD a
// random password is generated and printed once. Use this to replace the old
// seeded `admin123` password on any existing database.
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@styleiq.com';
  const provided = process.env.ADMIN_PASSWORD;
  if (provided && provided.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  }
  const password = provided || randomBytes(18).toString('base64url');
  const hash = await bcrypt.hash(password, 12);

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    await prisma.adminUser.update({ where: { email }, data: { password: hash } });
    console.log(`Updated password for admin ${email}.`);
  } else {
    await prisma.adminUser.create({ data: { email, password: hash, name: 'Admin' } });
    console.log(`Created admin ${email}.`);
  }
  if (!provided) console.log(`Generated password (shown once, store it now): ${password}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
