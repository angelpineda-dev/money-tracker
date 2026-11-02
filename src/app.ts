import "dotenv/config"
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { router } from './routes/index.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { apiLimiter } from './middlewares/rateLimiter.ts';

const app: Express = express();
const port: number = 3000;

app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true
}));
app.use(express.json());
app.use(apiLimiter);

app.get('/health', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'OK' });
});

app.use('/api', router);
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
