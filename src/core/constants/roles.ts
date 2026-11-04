import { Role } from '#generated/prisma/enums.ts';

// Role values come from the Prisma `Role` enum (prisma/schema.prisma), the single source.
export const ROLE = Role;

// Ordered from most to least privileged: the index is the role's rank.
export const ROLES = [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.USER] as const;

// Compile-time guard: a role added to the schema but not ranked above fails `tsc`.
type UnrankedRole = Exclude<Role, (typeof ROLES)[number]>;
const _allRolesRanked: [UnrankedRole] extends [never] ? true : never = true;

// Roles allowed to manage other users' roles.
export const ROLE_MANAGERS = [ROLE.SUPER_ADMIN, ROLE.ADMIN] as const;
