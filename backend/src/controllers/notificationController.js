import { pool } from '../database/pool.js';
import { sendWhatsApp } from '../integrations/whatsapp.js';
import { sendSms } from '../integrations/sms.js';
import { normalizePhone } from '../utils/phone.js';
import { validateAcademicMessage } from '../utils/message.js';
import { audit } from '../services/audit.js';

async function dispatch(channel, phone, body) {
  return channel === 'whatsapp' ? sendWhatsApp(phone, body) : sendSms(phone, body);
}

export async function createAndSend(req, res, next) {
  const { titulo, mensagem, categoria, id_curso, ids_alunos, canal = 'whatsapp' } = req.body;
  const validationError = validateAcademicMessage(titulo, mensagem, categoria);
  if (validationError) return res.status(400).json({ error: validationError });
  if (!id_curso || !['whatsapp','sms'].includes(canal) || !Array.isArray(ids_alunos) || ids_alunos.length < 1) return res.status(400).json({ error: 'Selecione curso, canal e ao menos um aluno.' });
  try {
    const course = await pool.query('SELECT id_curso,id_instituicao FROM cursos WHERE id_curso=$1 AND ativo=true', [id_curso]);
    if (!course.rowCount || (req.user.cargo !== 'admin' && course.rows[0].id_instituicao !== req.user.id_instituicao)) return res.status(403).json({ error: 'Curso inexistente ou fora da sua instituição.' });
    if (req.user.cargo === 'professor') {
      const authorized = await pool.query('SELECT 1 FROM autorizacoes_curso WHERE id_curso=$1 AND id_usuario=$2', [id_curso, req.user.sub]);
      if (!authorized.rowCount) return res.status(403).json({ error: 'Você não está autorizado a enviar notificações para este curso.' });
    }
    const result = await pool.query(`SELECT a.id_aluno,a.telefone FROM alunos a JOIN matriculas m ON m.id_aluno=a.id_aluno
      WHERE a.id_aluno=ANY($1::uuid[]) AND m.id_curso=$2 AND m.status='ativo' AND a.status_matricula='ativo' AND a.id_instituicao=$3`,
      [ids_alunos, id_curso, course.rows[0].id_instituicao]);
    const validIds = new Set(result.rows.map((row) => row.id_aluno));
    if (validIds.size !== new Set(ids_alunos).size) return res.status(400).json({ error: 'A seleção contém aluno sem matrícula ativa neste curso.' });
    const created = await pool.query(`INSERT INTO notificacoes(titulo,mensagem,categoria,canal_utilizado,id_usuario,id_curso)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id_notificacao`, [titulo.trim(), mensagem.trim(), categoria, canal, req.user.sub, id_curso]);
    const notificationId = created.rows[0].id_notificacao;
    const outcomes = await Promise.all(result.rows.map(async (student) => {
      let status = 'falha'; let usedChannel = canal; let providerId = null; let reason = null;
      const phone = normalizePhone(student.telefone);
      if (!phone) reason = 'Telefone inválido.';
      else {
        try { providerId = await dispatch(canal, phone, `${titulo.trim()}\n${mensagem.trim()}`); status = 'enviada'; }
        catch (primaryError) {
          reason = primaryError.message;
          if (canal === 'whatsapp' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
            try { providerId = await sendSms(phone, `${titulo.trim()}\n${mensagem.trim()}`); status = 'enviada'; usedChannel = 'sms'; reason = null; }
            catch (fallbackError) { reason = `WhatsApp: ${primaryError.message}; SMS: ${fallbackError.message}`; usedChannel = 'sms'; }
          }
        }
      }
      await pool.query(`INSERT INTO entregas_notificacao(id_notificacao,id_aluno,status_entrega,canal_utilizado,motivo_falha,provider_message_id)
        VALUES($1,$2,$3,$4,$5,$6)`, [notificationId, student.id_aluno, status, usedChannel, reason, providerId]);
      return { id_aluno: student.id_aluno, status_entrega: status, canal_utilizado: usedChannel, motivo_falha: reason };
    }));
    await audit({ userId: req.user.sub, action: 'enviar', entity: 'notificacao', entityId: notificationId, details: { id_curso, total: outcomes.length, falhas: outcomes.filter((x) => x.status_entrega === 'falha').length } });
    res.status(201).json({ id_notificacao: notificationId, entregas: outcomes });
  } catch (error) { next(error); }
}

export async function listNotifications(req, res, next) {
  try {
    const values = []; let filters = [];
    if (req.user.cargo !== 'admin') { values.push(req.user.id_instituicao); filters.push(`c.id_instituicao=$${values.length}`); }
    if (req.user.cargo === 'professor') { values.push(req.user.sub); filters.push(`EXISTS (SELECT 1 FROM autorizacoes_curso ac WHERE ac.id_curso=n.id_curso AND ac.id_usuario=$${values.length})`); }
    const scope = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await pool.query(`SELECT n.id_notificacao,n.titulo,n.mensagem,n.categoria,n.data_envio,n.canal_utilizado,
      c.nome_curso,u.nome AS responsavel, COUNT(e.id_entrega)::int AS total,
      COUNT(e.id_entrega) FILTER (WHERE e.status_entrega='falha')::int AS falhas
      FROM notificacoes n JOIN cursos c ON c.id_curso=n.id_curso JOIN usuarios u ON u.id_usuario=n.id_usuario
      LEFT JOIN entregas_notificacao e ON e.id_notificacao=n.id_notificacao ${scope}
      GROUP BY n.id_notificacao,c.nome_curso,u.nome ORDER BY n.data_envio DESC LIMIT 200`, values);
    res.json(result.rows);
  } catch (error) { next(error); }
}

export async function listLogs(req, res, next) {
  try {
    const teacherId = req.user.cargo === 'professor' ? req.user.sub : null;
    const result = await pool.query(`SELECT e.id_entrega,e.status_entrega,e.canal_utilizado,e.data_hora,e.motivo_falha,
      a.nome AS aluno,n.titulo,n.id_notificacao FROM entregas_notificacao e
      JOIN alunos a ON a.id_aluno=e.id_aluno JOIN notificacoes n ON n.id_notificacao=e.id_notificacao
      JOIN cursos c ON c.id_curso=n.id_curso WHERE e.status_entrega='falha' AND ($1::boolean OR c.id_instituicao=$2)
      AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM autorizacoes_curso ac WHERE ac.id_curso=n.id_curso AND ac.id_usuario=$3))
      ORDER BY e.data_hora DESC LIMIT 500`, [req.user.cargo === 'admin', req.user.id_instituicao, teacherId]);
    res.json(result.rows);
  } catch (error) { next(error); }
}
