export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'USER'] as const;

export type Roles = typeof ROLES[number];

export interface ReqUser {
    id: string;
    role: Roles;
    sid: number;
}
