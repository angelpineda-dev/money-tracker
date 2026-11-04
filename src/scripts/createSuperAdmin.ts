import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../prisma/.env') });
config({ path: resolve(__dirname, '../../.env') });

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { ROLE } from '#core/constants/roles.ts';
import { BCRYPT_ROUNDS } from '#core/constants/security.ts';
import { PrismaClient } from '#generated/prisma/client.ts';
import { registerSchema } from '#validators/auth.ts';

// Bootstraps the FIRST SUPER_ADMIN (e.g. right after deploying to production).
// Once any SUPER_ADMIN exists it is a no-op, so it's safe to run on every deploy
// and the env vars can't be reused to mint more: further admins go through
// PATCH /api/user/:id/role. It never promotes an existing account nor
// overwrites a password, so it can't be used to take one over.
// SUPER_ADMIN_PASSWORD is optional: when empty, a strong one is generated and
// printed once, so production doesn't need the password in its config.

const prisma = new PrismaClient();

// 24 random base64url chars, plus 'A1' so it always meets the register rules
// (one uppercase, one digit).
const generatePassword = () => `${randomBytes(18).toString('base64url')}A1`;

async function main() {
    const current = await prisma.users.findFirst({ where: { role: ROLE.SUPER_ADMIN }, select: { email: true } });
    if (current) {
        console.log(
            `Super admin already exists (${current.email}), nothing to do. Use PATCH /api/user/:id/role to add more.`,
        );
        return;
    }

    const envPassword = process.env.SUPER_ADMIN_PASSWORD || undefined;
    const password = envPassword ?? generatePassword();
    const input = {
        email: process.env.SUPER_ADMIN_EMAIL,
        name: process.env.SUPER_ADMIN_NAME,
        password,
    };

    // Same rules as POST /api/auth/register.
    const parsed = registerSchema.safeParse({ ...input, confirmed_password: password });
    if (!parsed.success) {
        // confirmed_password mirrors password, so its issues would just repeat.
        const issues = parsed.error.issues
            .filter((i) => i.path[0] !== 'confirmed_password')
            .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        throw new Error(
            `Invalid SUPER_ADMIN_EMAIL / SUPER_ADMIN_NAME / SUPER_ADMIN_PASSWORD in the environment:\n${issues}`,
        );
    }
    const { email, name } = parsed.data;

    const existing = await prisma.users.findUnique({ where: { email }, select: { role: true } });
    if (existing) {
        throw new Error(
            `${email} already exists with role ${existing.role}. Use another email or change its role via PATCH /api/user/:id/role.`,
        );
    }

    const user = await prisma.users.create({
        data: { email, name, password: await bcrypt.hash(password, BCRYPT_ROUNDS), role: ROLE.SUPER_ADMIN },
        select: { id: true },
    });
    console.log(`Super admin ${email} created (id=${user.id}).`);
    if (!envPassword) {
        console.log(`Generated password (shown only once): ${password}`);
        console.log('Store it now and change it via PATCH /api/user/me/password after logging in.');
    }
}

main()
    .catch((e: unknown) => {
        console.error(e instanceof Error ? e.message : e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
