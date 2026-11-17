const PASSWORD_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Generate an unambiguous random password (avoids 0/O, 1/l/I)
 * using crypto.getRandomValues when available.
 */
export function generateRandomPassword(length = 6): string {
  const chars = PASSWORD_CHARSET;
  const result: string[] = [];

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(length);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result.push(chars[bytes[i] % chars.length]);
    }
    return result.join('');
  }

  for (let i = 0; i < length; i++) {
    result.push(chars[Math.floor(Math.random() * chars.length)]);
  }
  return result.join('');
}
