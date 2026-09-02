import "dotenv/config"
import express, { type Express, type Request, type Response } from 'express';
import { router } from './routes/index.ts';
import { errorHandler } from './middlewares/errorHandler.ts';

const app: Express = express();
const port: number = 3000;

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    res.send('Hello, World!');
});

app.use('/api', router);
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});