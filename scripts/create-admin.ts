import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Error: ADMIN_EMAIL/ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env file');
    process.exit(1);
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12); // keep in step with BCRYPT_COST in lib/auth.ts

    // Upsert, never deleteMany: re-running this must not wipe other accounts.
    // This script (and prisma/seed.ts) is the ONLY way an account becomes
    // admin — no API route or UI writes User.role. Re-running it is also the
    // password reset: the sessionVersion bump signs out every existing session.
    await prisma.user.upsert({
      where: { username: email },
      update: { password: hashedPassword, role: 'admin', sessionVersion: { increment: 1 } },
      create: { username: email, password: hashedPassword, role: 'admin' },
    });

    console.log('✅ Admin user ready!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔒 Password: (hidden for security)`);
    console.log('');
    console.log('🎉 You can now login at: /account/login (admins land on /admin)');

    // Exactly one admin (the owner) is the invariant. Report, never auto-demote:
    // deciding which account is the stray one is a human call.
    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { username: true } });
    if (admins.length > 1) {
      console.warn(`⚠️  ${admins.length} admin accounts exist: ${admins.map((a) => a.username).join(', ')}`);
      console.warn("   Demote any that are not yours: UPDATE User SET role='user', sessionVersion=sessionVersion+1 WHERE username='...';");
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
