import bcrypt from 'bcryptjs';
import { pool } from '../database/pool.js';
import { audit } from '../services/audit.js';
import { normalizePhone } from '../utils/phone.js';

function institutionScope(user, offset = 1) {
  return user.cargo === 'admin' ? { clause: '', values: [] } : { clause: ` AND id_instituicao = $${offset}`, values: [user.id_instituicao] };
}

export async function listCourses(req, res, next) {
  try {
    const values = []; let scope = '';
    if (req.user.cargo !== 'admin') { values.push(req.user.id_instituicao); scope += ` AND c.id_instituicao=$${values.length}`; }
    if (req.user.cargo === 'professor') { values.push(req.user.sub); scope += ` AND EXISTS (SELECT 1 FROM autorizacoes_curso ac WHERE ac.id_curso=c.id_curso AND ac.id_usuario=$${values.length})`; }
    const result = await pool.query(`SELECT c.id_curso,c.nome_curso,c.id_instituicao,c.ativo FROM cursos c WHERE c.ativo=true${scope} ORDER BY c.nome_curso`, values);
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function createCourse(req, res, next) {
  try {
    const institutionId = req.user.cargo === 'admin' ? req.body.id_instituicao : req.user.id_instituicao;
    if (!req.body.nome_curso || !institutionId) return res.status(400).json({ error: 'Nome do curso e instituição são obrigatórios.' });
    const result = await pool.query('INSERT INTO cursos(nome_curso,id_instituicao) VALUES($1,$2) RETURNING *', [req.body.nome_curso.trim(), institutionId]);
    await audit({ userId: req.user.sub, action: 'criar', entity: 'curso', entityId: result.rows[0].id_curso });
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
}

export async function updateCourse(req, res, next) {
  try {
    const { nome_curso, ativo } = req.body;
    const scope = req.user.cargo === 'admin' ? '' : ' AND id_instituicao=$3';
    const values = [nome_curso?.trim() || null, ativo ?? true, req.params.id];
    if (scope) values.push(req.user.id_instituicao);
    const result = await pool.query(`UPDATE cursos SET nome_curso=COALESCE($1,nome_curso),ativo=$2 WHERE id_curso=$3${scope} RETURNING *`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Curso não encontrado.' });
    await audit({ userId: req.user.sub, action: 'atualizar', entity: 'curso', entityId: req.params.id });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
}

export async function deleteCourse(req, res, next) {
  try {
    const values = [req.params.id]; let scope = '';
    if (req.user.cargo !== 'admin') { values.push(req.user.id_instituicao); scope = ' AND id_instituicao=$2'; }
    const result = await pool.query(`UPDATE cursos SET ativo=false WHERE id_curso=$1${scope} RETURNING id_curso`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Curso não encontrado.' });
    await audit({ userId: req.user.sub, action: 'arquivar', entity: 'curso', entityId: req.params.id });
    res.status(204).end();
  } catch (error) { next(error); }
}

export async function authorizeCourseUser(req, res, next) {
  try {
    const { id_usuario } = req.body;
    const values = [req.params.id]; let scope = '';
    if (req.user.cargo !== 'admin') { values.push(req.user.id_instituicao); scope = ' AND id_instituicao=$2'; }
    const course = await pool.query(`SELECT id_curso FROM cursos WHERE id_curso=$1${scope}`, values);
    if (!course.rowCount) return res.status(404).json({ error: 'Curso não encontrado.' });
    const user = await pool.query("SELECT id_usuario FROM usuarios WHERE id_usuario=$1 AND cargo='professor' AND ativo=true AND id_instituicao=(SELECT id_instituicao FROM cursos WHERE id_curso=$2)", [id_usuario, req.params.id]);
    if (!user.rowCount) return res.status(400).json({ error: 'O usuário deve ser professor ativo da mesma instituição.' });
    await pool.query('INSERT INTO autorizacoes_curso(id_usuario,id_curso,autorizado_por) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [id_usuario, req.params.id, req.user.sub]);
    await audit({ userId: req.user.sub, action: 'autorizar', entity: 'professor_curso', entityId: `${id_usuario}:${req.params.id}` });
    res.status(204).end();
  } catch (error) { next(error); }
}

export async function revokeCourseUser(req, res, next) {
  try {
    const values = [req.params.id, req.params.userId]; let scope = '';
    if (req.user.cargo !== 'admin') { values.push(req.user.id_instituicao); scope = ` AND EXISTS (SELECT 1 FROM cursos c WHERE c.id_curso=autorizacoes_curso.id_curso AND c.id_instituicao=$3)`; }
    const result = await pool.query(`DELETE FROM autorizacoes_curso WHERE id_curso=$1 AND id_usuario=$2${scope} RETURNING id_usuario`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Autorização não encontrada.' });
    await audit({ userId: req.user.sub, action: 'revogar', entity: 'professor_curso', entityId: `${req.params.userId}:${req.params.id}` });
    res.status(204).end();
  } catch (error) { next(error); }
}

export async function listStudents(req, res, next) {
  try {
    const params = [];
    let where = 'WHERE a.status_matricula=\'ativo\'';
    if (req.user.cargo !== 'admin') { params.push(req.user.id_instituicao); where += ` AND a.id_instituicao=$${params.length}`; }
    if (req.query.id_curso) { params.push(req.query.id_curso); where += ` AND EXISTS (SELECT 1 FROM matriculas m WHERE m.id_aluno=a.id_aluno AND m.id_curso=$${params.length} AND m.status='ativo')`; }
    if (req.query.id_curso && req.user.cargo === 'professor') {
      const authorized = await pool.query('SELECT 1 FROM autorizacoes_curso WHERE id_curso=$1 AND id_usuario=$2', [req.query.id_curso, req.user.sub]);
      if (!authorized.rowCount) return res.status(403).json({ error: 'Você não está autorizado a acessar este curso.' });
    }
    const result = await pool.query(`SELECT a.id_aluno,a.nome,a.email,a.telefone,a.status_matricula,a.id_instituicao FROM alunos a ${where} ORDER BY a.nome`, params);
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function createStudent(req, res, next) {
  try {
    const { nome, email, telefone, id_curso } = req.body;
    const phone = normalizePhone(telefone);
    const institutionId = req.user.cargo === 'admin' ? req.body.id_instituicao : req.user.id_instituicao;
    if (!nome?.trim() || !phone || !institutionId) return res.status(400).json({ error: 'Nome, instituição e telefone válido são obrigatórios.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (id_curso) {
        const course = await client.query('SELECT id_curso FROM cursos WHERE id_curso=$1 AND id_instituicao=$2 AND ativo=true', [id_curso, institutionId]);
        if (!course.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Curso inválido para esta instituição.' }); }
      }
      const inserted = await client.query('INSERT INTO alunos(nome,email,telefone,id_instituicao) VALUES($1,$2,$3,$4) RETURNING *', [nome.trim(), email || null, phone, institutionId]);
      if (id_curso) await client.query("INSERT INTO matriculas(id_aluno,id_curso,status) VALUES($1,$2,'ativo')", [inserted.rows[0].id_aluno, id_curso]);
      await client.query('COMMIT');
      await audit({ userId: req.user.sub, action: 'criar', entity: 'aluno', entityId: inserted.rows[0].id_aluno });
      res.status(201).json(inserted.rows[0]);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } catch (error) { next(error); }
}

export async function updateStudent(req, res, next) {
  try {
    const { nome, email, telefone, status_matricula } = req.body;
    const phone = telefone === undefined ? null : normalizePhone(telefone);
    if (telefone !== undefined && !phone) return res.status(400).json({ error: 'Telefone inválido.' });
    const values = [nome?.trim() || null, email ?? null, phone, status_matricula ?? null, req.params.id];
    let scope = '';
    if (req.user.cargo !== 'admin') { values.push(req.user.id_instituicao); scope = ` AND id_instituicao=$${values.length}`; }
    const result = await pool.query(`UPDATE alunos SET nome=COALESCE($1,nome),email=COALESCE($2,email),telefone=COALESCE($3,telefone),status_matricula=COALESCE($4,status_matricula) WHERE id_aluno=$5${scope} RETURNING id_aluno,nome,email,telefone,status_matricula,id_instituicao`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Aluno não encontrado.' });
    await audit({ userId: req.user.sub, action: 'atualizar', entity: 'aluno', entityId: req.params.id });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
}

export async function deleteStudent(req, res, next) {
  try {
    const values = [req.params.id]; let scope = '';
    if (req.user.cargo !== 'admin') { values.push(req.user.id_instituicao); scope = ' AND id_instituicao=$2'; }
    const result = await pool.query(`UPDATE alunos SET status_matricula='concluido' WHERE id_aluno=$1${scope} RETURNING id_aluno`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Aluno não encontrado.' });
    await pool.query("UPDATE matriculas SET status='concluido',atualizado_em=now() WHERE id_aluno=$1", [req.params.id]);
    await audit({ userId: req.user.sub, action: 'inativar', entity: 'aluno', entityId: req.params.id });
    res.status(204).end();
  } catch (error) { next(error); }
}

export async function listInstitutions(req, res, next) {
  try {
    const result = await pool.query('SELECT id_instituicao,nome_instituicao,url_plataforma,tipo_integracao FROM instituicoes ORDER BY nome_instituicao');
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function createInstitution(req, res, next) {
  try {
    const { nome_instituicao, url_plataforma = null, tipo_integracao = 'manual' } = req.body;
    if (!nome_instituicao?.trim() || !['api','arquivo','manual'].includes(tipo_integracao)) return res.status(400).json({ error: 'Informe nome e tipo de integração válido.' });
    const result = await pool.query('INSERT INTO instituicoes(nome_instituicao,url_plataforma,tipo_integracao) VALUES($1,$2,$3) RETURNING *', [nome_instituicao.trim(), url_plataforma, tipo_integracao]);
    await audit({ userId: req.user.sub, action: 'criar', entity: 'instituicao', entityId: result.rows[0].id_instituicao });
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
}

export async function updateInstitution(req, res, next) {
  try {
    const { nome_instituicao, url_plataforma, tipo_integracao } = req.body;
    if (tipo_integracao && !['api','arquivo','manual'].includes(tipo_integracao)) return res.status(400).json({ error: 'Tipo de integração inválido.' });
    const result = await pool.query(`UPDATE instituicoes SET nome_instituicao=COALESCE($1,nome_instituicao),url_plataforma=COALESCE($2,url_plataforma),tipo_integracao=COALESCE($3,tipo_integracao) WHERE id_instituicao=$4 RETURNING *`, [nome_instituicao?.trim() || null, url_plataforma ?? null, tipo_integracao ?? null, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Instituição não encontrada.' });
    await audit({ userId: req.user.sub, action: 'atualizar', entity: 'instituicao', entityId: req.params.id });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
}

export async function deleteInstitution(req, res, next) {
  try {
    const result = await pool.query('DELETE FROM instituicoes WHERE id_instituicao=$1 RETURNING id_instituicao', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Instituição não encontrada.' });
    await audit({ userId: req.user.sub, action: 'excluir', entity: 'instituicao', entityId: req.params.id });
    res.status(204).end();
  } catch (error) { next(error); }
}

export async function listUsers(req, res, next) {
  try {
    const result = req.user.cargo === 'admin'
      ? await pool.query('SELECT id_usuario,nome,email,cargo,id_instituicao,ativo FROM usuarios ORDER BY nome')
      : await pool.query('SELECT id_usuario,nome,email,cargo,id_instituicao,ativo FROM usuarios WHERE id_instituicao=$1 ORDER BY nome', [req.user.id_instituicao]);
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function createUser(req, res, next) {
  try {
    const { nome, email, senha, cargo, id_instituicao } = req.body;
    if (!nome?.trim() || !email || !senha || senha.length < 10 || !['coordenador','professor','admin'].includes(cargo)) return res.status(400).json({ error: 'Dados inválidos. A senha deve ter ao menos 10 caracteres.' });
    const result = await pool.query('INSERT INTO usuarios(nome,email,senha_hash,cargo,id_instituicao) VALUES($1,$2,$3,$4,$5) RETURNING id_usuario,nome,email,cargo,id_instituicao,ativo', [nome.trim(), email, await bcrypt.hash(senha, 12), cargo, id_instituicao || null]);
    await audit({ userId: req.user.sub, action: 'criar', entity: 'usuario', entityId: result.rows[0].id_usuario });
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
}

export async function updateUser(req, res, next) {
  try {
    const { nome, cargo, ativo, senha } = req.body;
    if (cargo && !['admin','coordenador','professor'].includes(cargo)) return res.status(400).json({ error: 'Cargo inválido.' });
    const hash = senha ? await bcrypt.hash(senha, 12) : null;
    if (senha && senha.length < 10) return res.status(400).json({ error: 'A senha deve ter ao menos 10 caracteres.' });
    const result = await pool.query(`UPDATE usuarios SET nome=COALESCE($1,nome),cargo=COALESCE($2,cargo),ativo=COALESCE($3,ativo),senha_hash=COALESCE($4,senha_hash) WHERE id_usuario=$5 RETURNING id_usuario,nome,email,cargo,id_instituicao,ativo`, [nome?.trim() || null, cargo ?? null, ativo ?? null, hash, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Usuário não encontrado.' });
    await audit({ userId: req.user.sub, action: 'atualizar', entity: 'usuario', entityId: req.params.id });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
}

export async function deleteUser(req, res, next) {
  if (req.params.id === req.user.sub) return res.status(400).json({ error: 'Não é possível desativar a própria conta.' });
  try {
    const result = await pool.query('UPDATE usuarios SET ativo=false WHERE id_usuario=$1 RETURNING id_usuario', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Usuário não encontrado.' });
    await audit({ userId: req.user.sub, action: 'inativar', entity: 'usuario', entityId: req.params.id });
    res.status(204).end();
  } catch (error) { next(error); }
}
