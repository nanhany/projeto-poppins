import { parse } from 'csv-parse/sync';
import { pool } from '../database/pool.js';
import { normalizePhone } from '../utils/phone.js';
import { audit } from '../services/audit.js';

export async function importCsv(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'Envie um arquivo CSV no campo file.' });
  try {
    const institutionId = req.user.cargo === 'admin' ? req.body.id_instituicao : req.user.id_instituicao;
    if (!institutionId) return res.status(400).json({ error: 'Selecione uma instituição para importar o arquivo.' });
    const institution = await pool.query('SELECT 1 FROM instituicoes WHERE id_instituicao=$1', [institutionId]);
    if (!institution.rowCount) return res.status(400).json({ error: 'Instituição inválida.' });
    const rows = parse(req.file.buffer, { columns: true, bom: true, skip_empty_lines: true, trim: true });
    const required = ['nome','email','telefone','status_matricula','curso'];
    if (!rows.length || required.some((column) => !(column in rows[0]))) return res.status(400).json({ error: `CSV deve conter: ${required.join(', ')}.` });
    if (rows.length > 5000) return res.status(413).json({ error: 'O arquivo pode conter no máximo 5.000 linhas por importação.' });
    const client = await pool.connect(); let imported = 0; let rejected = 0;
    try {
      await client.query('BEGIN');
      for (const row of rows) {
        const phone = normalizePhone(row.telefone);
        const status = ['ativo','trancado','concluido'].includes(row.status_matricula) ? row.status_matricula : null;
        const course = await client.query('SELECT id_curso FROM cursos WHERE lower(nome_curso)=lower($1) AND id_instituicao=$2 AND ativo=true', [row.curso, institutionId]);
        if (!row.nome || !phone || !status || !course.rowCount) { rejected++; continue; }
        const student = await client.query(`INSERT INTO alunos(nome,email,telefone,status_matricula,id_instituicao) VALUES($1,$2,$3,$4,$5)
          ON CONFLICT (email,id_instituicao) DO UPDATE SET nome=EXCLUDED.nome,telefone=EXCLUDED.telefone,status_matricula=EXCLUDED.status_matricula
          RETURNING id_aluno`, [row.nome, row.email || null, phone, status, institutionId]);
        await client.query(`INSERT INTO matriculas(id_aluno,id_curso,status) VALUES($1,$2,$3)
          ON CONFLICT (id_aluno,id_curso) DO UPDATE SET status=EXCLUDED.status,atualizado_em=now()`, [student.rows[0].id_aluno, course.rows[0].id_curso, status]);
        imported++;
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    await audit({ userId: req.user.sub, action: 'importar_csv', entity: 'alunos', details: { importados: imported, rejeitados: rejected } });
    res.json({ importados: imported, rejeitados: rejected, total: rows.length });
  } catch (error) { next(error); }
}
