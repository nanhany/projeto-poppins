import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pool } from '../database/pool.js';

try {
  const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  console.log('Esquema do banco aplicado com sucesso.');
} catch (error) {
  console.error('Não foi possível aplicar o esquema do banco:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
