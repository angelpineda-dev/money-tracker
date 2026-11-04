import { z } from 'zod';
import { ROLES } from '#core/constants/roles.ts';

const passwordRules = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z
    .object({
        email: z.string().email('Invalid email format'),
        name: z.string().min(2, 'Name must be at least 2 characters').max(80, 'Name too long'),
        password: passwordRules,
        confirmed_password: z.string(),
    })
    .refine((d) => d.password === d.confirmed_password, {
        message: 'Passwords do not match',
        path: ['confirmed_password'],
    });

export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(80, 'Name too long').optional(),
});

export const changePasswordSchema = z
    .object({
        current_password: z.string().min(1, 'Current password is required'),
        new_password: passwordRules,
        confirmed_password: z.string(),
        // true → close every other session of the user after the password change.
        close_sessions: z.boolean().optional().default(false),
    })
    .refine((d) => d.new_password === d.confirmed_password, {
        message: 'Passwords do not match',
        path: ['confirmed_password'],
    });

export const changeRoleSchema = z.object({
    role: z.enum(ROLES, `Role must be one of: ${ROLES.join(', ')}`),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
