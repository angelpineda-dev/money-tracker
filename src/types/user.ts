import { ROLES } from '#core/constants/roles.ts';

export type Roles = (typeof ROLES)[number];

// True when `a` is strictly more privileged than `b`.
export const outranks = (a: Roles, b: Roles) => ROLES.indexOf(a) < ROLES.indexOf(b);

export interface ReqUser {
    id: string;
    role: Roles;
    sid: number;
}
