import 'dotenv/config';
import { app } from './app.js';
import { pool } from './database/pool.js';

const port = Number(process.env.PORT || 3000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres.');
await pool.query('SELECT 1');
app.listen(port, () => console.log(`Poppins API disponível na porta ${port}`));
