const PASSWORD_CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789';
const PASSWORD_SALT = '_salt_cbt_sma_2026';

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

/**
 * Compute SHA-256 hex digest matching the backend server salt so passwords
 * written from client fallback or server remain 100% consistent in Firestore.
 */
export async function hashPasswordAsync(password: string): Promise<string> {
  const input = `${password}${PASSWORD_SALT}`;
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}
