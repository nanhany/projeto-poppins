export async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) throw new Error('SMS Twilio não configurado.');
  const data = new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body });
  if (process.env.PUBLIC_API_URL) data.set('StatusCallback', `${process.env.PUBLIC_API_URL.replace(/\/$/, '')}/webhooks/twilio`);
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: data,
    signal: AbortSignal.timeout(8000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || `Twilio respondeu ${response.status}.`);
  return result.sid;
}
