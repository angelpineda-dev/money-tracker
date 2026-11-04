// Ordered from most to least privileged: the index is the role's rank.
export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'USER'] as const;

export type Roles = (typeof ROLES)[number];

// Roles allowed to manage other users' roles.
export const ROLE_MANAGERS = ['SUPER_ADMIN', 'ADMIN'] as const satisfies readonly Roles[];

// True when `a` is strictly more privileged than `b`.
export const outranks = (a: Roles, b: Roles) => ROLES.indexOf(a) < ROLES.indexOf(b);

export interface ReqUser {
    id: string;
    role: Roles;
    sid: number;
}
