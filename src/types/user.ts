export type Roles = "SUPER_ADMIN" | "ADMIN" | "USER";

export interface ReqUser {
    id: number;
    role: Roles;
}