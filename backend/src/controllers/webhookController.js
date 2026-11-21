import crypto from 'node:crypto';
import { pool } from '../database/pool.js';

function safeEqual(left, right) {
  const a = Buffer.from(left || ''); const b = Buffer.from(right || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyMeta(req, res) {
  const { META_WEBHOOK_VERIFY_TOKEN } = process.env;
  if (req.query['hub.mode'] === 'subscribe' && META_WEBHOOK_VERIFY_TOKEN && safeEqual(req.query['hub.verify_token'], META_WEBHOOK_VERIFY_TOKEN)) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
}

export async function metaStatus(req, res) {
  const secret = process.env.META_APP_SECRET;
  const supplied = req.get('x-hub-signature-256') || '';
  const expected = secret ? `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.alloc(0)).digest('hex')}` : '';
  if (!secret || !safeEqual(supplied, expected)) return res.sendStatus(401);
  try {
    const statuses = (req.body.entry || []).flatMap((entry) => entry.changes || []).flatMap((change) => change.value?.statuses || []);
    for (const item of statuses) {
      const deliveryStatus = item.status === 'delivered' || item.status === 'read' ? 'entregue' : item.status === 'failed' ? 'falha' : item.status === 'sent' ? 'enviada' : null;
      if (!deliveryStatus || !item.id) continue;
      const reason = item.errors?.map((error) => error.title || error.message).join('; ') || null;
      await pool.query(`UPDATE entregas_notificacao SET status_entrega=$1,motivo_falha=COALESCE($2,motivo_falha),data_hora=now()
        WHERE provider_message_id=$3 AND canal_utilizado='whatsapp'`, [deliveryStatus, reason, item.id]);
    }
    res.sendStatus(200);
  } catch (error) { console.error('Falha ao processar webhook Meta:', error.message); res.sendStatus(500); }
}

export async function twilioStatus(req, res) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const publicBase = process.env.PUBLIC_API_URL?.replace(/\/$/, '');
  if (!authToken || !publicBase) return res.sendStatus(503);
  const url = `${publicBase}${req.originalUrl}`;
  const params = Object.keys(req.body).sort().map((key) => `${key}${req.body[key]}`).join('');
  const expected = crypto.createHmac('sha1', authToken).update(url + params).digest('base64');
  if (!safeEqual(req.get('x-twilio-signature'), expected)) return res.sendStatus(401);
  const status = req.body.MessageStatus;
  const deliveryStatus = ['delivered','read'].includes(status) ? 'entregue' : ['failed','undelivered'].includes(status) ? 'falha' : ['accepted','queued','sending','sent'].includes(status) ? 'enviada' : null;
  if (!deliveryStatus || !req.body.MessageSid) return res.sendStatus(204);
  try {
    const reason = req.body.ErrorCode ? `Twilio ${req.body.ErrorCode}: ${req.body.ErrorMessage || 'falha no envio.'}` : null;
    await pool.query(`UPDATE entregas_notificacao SET status_entrega=$1,motivo_falha=COALESCE($2,motivo_falha),data_hora=now()
      WHERE provider_message_id=$3 AND canal_utilizado='sms'`, [deliveryStatus, reason, req.body.MessageSid]);
    res.sendStatus(204);
  } catch (error) { console.error('Falha ao processar webhook Twilio:', error.message); res.sendStatus(500); }
}
