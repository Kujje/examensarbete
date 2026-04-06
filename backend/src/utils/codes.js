const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DIGITS = '0123456789';

function randomFromCharset(length, charset) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += charset[Math.floor(Math.random() * charset.length)];
  return out;
}

export function generateCode(length = 6) {
  return randomFromCharset(length, ALPHANUM);
}

export function generatePin(length = 6) {
  return randomFromCharset(length, DIGITS);
}

export function generatePlayerId() {
  return `p_${randomFromCharset(8, 'abcdefghijklmnopqrstuvwxyz0123456789')}`;
}