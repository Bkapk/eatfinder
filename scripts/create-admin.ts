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
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upsert, never deleteMany: re-running this must not wipe other accounts.
    await prisma.user.upsert({
      where: { username: email },
      update: { password: hashedPassword },
      create: { username: email, password: hashedPassword },
    });

    console.log('✅ Admin user ready!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔒 Password: (hidden for security)`);
    console.log('');
    console.log('🎉 You can now login at: /admin/login');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

