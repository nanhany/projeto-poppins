import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function normalizePhone(value) {
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(String(value), process.env.DEFAULT_PHONE_REGION || 'BR');
  return parsed?.isValid() ? parsed.number : null;
}
