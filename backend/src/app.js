import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { verifyMeta, metaStatus, twilioStatus } from './controllers/webhookController.js';

export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb', verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: false }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/webhooks/meta', verifyMeta);
app.post('/webhooks/meta', metaStatus);
app.post('/webhooks/twilio', twilioStatus);
app.use('/api', routes);
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === '23505') return res.status(409).json({ error: 'Registro já existe.' });
  res.status(500).json({ error: 'Não foi possível concluir a solicitação.' });
});
