import * as crypto from 'crypto';

// AES-256-GCM encryption for Slack message fields
// Key should be 32 bytes (256 bits) hex-encoded = 64 hex chars

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Lazy-loaded encryption key
let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (!_encryptionKey) {
    const keyHex = process.env.SLACK_ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error(
        'SLACK_ENCRYPTION_KEY environment variable is required. ' +
          'Generate one with: openssl rand -hex 32'
      );
    }
    if (keyHex.length !== 64) {
      throw new Error(
        'SLACK_ENCRYPTION_KEY must be 64 hex characters (32 bytes). ' +
          'Generate one with: openssl rand -hex 32'
      );
    }
    _encryptionKey = Buffer.from(keyHex, 'hex');
  }
  return _encryptionKey;
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 * Expects format: iv:authTag:ciphertext (all base64)
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected iv:authTag:ciphertext');
  }

  const [ivB64, authTagB64, ciphertext] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt a field if it has a value, return null otherwise
 */
export function encryptField(value: string | undefined | null): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return encrypt(value);
}

/**
 * Decrypt a field if it has a value, return undefined otherwise
 */
export function decryptField(encryptedValue: string | undefined | null): string | undefined {
  if (encryptedValue === undefined || encryptedValue === null || encryptedValue === '') {
    return undefined;
  }
  return decrypt(encryptedValue);
}

/**
 * Check if encryption key is configured
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.SLACK_ENCRYPTION_KEY;
}

/**
 * Validate encryption key format without loading it
 */
export function validateEncryptionKey(): { valid: boolean; error?: string } {
  const keyHex = process.env.SLACK_ENCRYPTION_KEY;
  if (!keyHex) {
    return { valid: false, error: 'SLACK_ENCRYPTION_KEY not set' };
  }
  if (keyHex.length !== 64) {
    return { valid: false, error: `Key must be 64 hex chars, got ${keyHex.length}` };
  }
  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    return { valid: false, error: 'Key must be hexadecimal' };
  }
  return { valid: true };
}

/**
 * Reset cached key (for testing)
 */
export function resetEncryptionKey(): void {
  _encryptionKey = null;
}
