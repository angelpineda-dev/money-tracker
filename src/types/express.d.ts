import { ReqUser } from './user.ts';

declare global {
    namespace Express {
        interface Request {
            user?: ReqUser;
        }
    }
}
