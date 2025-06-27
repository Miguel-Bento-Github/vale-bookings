import crypto from 'crypto';

import { ENCRYPTION_CONFIG, API_KEY_CONFIG, REFERENCE_NUMBER_CONFIG } from '../constants/widget';

/**
 * Encryption utility for PII fields
 * Uses AES-256-GCM for authenticated encryption
 */
export class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: Buffer;

  private constructor() {
    // Use environment variable for encryption key or generate one
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // Derive encryption key from the provided key
    this.encryptionKey = this.deriveKey(key);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Derive encryption key from password
   */
  private deriveKey(password: string): Buffer {
    const salt = process.env.ENCRYPTION_SALT || 'vale-widget-salt';
    return crypto.pbkdf2Sync(
      password,
      salt,
      ENCRYPTION_CONFIG.ITERATIONS,
      ENCRYPTION_CONFIG.KEY_LENGTH,
      'sha256'
    );
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        ENCRYPTION_CONFIG.ALGORITHM,
        this.encryptionKey,
        iv
      );
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      // Get auth tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const combined = Buffer.concat([
        iv,
        authTag,
        encrypted
      ]);
      
      // Return base64 encoded
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData: string): string {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const iv = combined.slice(0, ENCRYPTION_CONFIG.IV_LENGTH);
      const authTag = combined.slice(
        ENCRYPTION_CONFIG.IV_LENGTH,
        ENCRYPTION_CONFIG.IV_LENGTH + ENCRYPTION_CONFIG.TAG_LENGTH
      );
      const encrypted = combined.slice(
        ENCRYPTION_CONFIG.IV_LENGTH + ENCRYPTION_CONFIG.TAG_LENGTH
      );
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_CONFIG.ALGORITHM,
        this.encryptionKey,
        iv
      );
      
      // Set auth tag
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Hash data using SHA-256 (for non-reversible data like API keys)
   */
  hash(data: string, salt?: string): string {
    const dataToHash = salt ? `${data}${salt}` : data;
    return crypto
      .createHash(API_KEY_CONFIG.HASH_ALGORITHM)
      .update(dataToHash)
      .digest('hex');
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate reference number
   */
  generateReferenceNumber(): string {
    const { LENGTH, CHARSET, PREFIX } = REFERENCE_NUMBER_CONFIG;
    let reference = PREFIX;
    
    for (let i = 0; i < LENGTH - PREFIX.length; i++) {
      const randomIndex = crypto.randomInt(0, CHARSET.length);
      reference += CHARSET[randomIndex];
    }
    
    return reference;
  }

  /**
   * Timing-safe comparison for tokens
   */
  timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    
    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance(); 