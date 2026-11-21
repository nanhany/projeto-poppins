import { pool } from '../database/pool.js';

export async function audit({ userId = null, action, entity, entityId = null, details = {} }) {
  await pool.query(
    'INSERT INTO auditoria (id_usuario, acao, entidade, entidade_id, detalhes) VALUES ($1,$2,$3,$4,$5)',
    [userId, action, entity, entityId, JSON.stringify(details)]
  );
}
