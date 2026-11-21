export async function sendWhatsApp(to, body) {
  const { META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_API_VERSION = 'v21.0' } = process.env;
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) throw new Error('WhatsApp Cloud API não configurada.');
  const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace('+', ''), type: 'text', text: { preview_url: false, body } }),
    signal: AbortSignal.timeout(8000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || `Meta API respondeu ${response.status}.`);
  return result.messages?.[0]?.id;
}
