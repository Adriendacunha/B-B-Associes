import { describe, it, expect } from 'vitest';
import { deriveKey, encryptBuffer, decryptBuffer, isEncrypted } from './crypto';

const key = deriveKey('une-passphrase-de-test');

describe('chiffrement au repos (§9)', () => {
  it('round-trip : déchiffre ce qui a été chiffré', () => {
    const plain = Buffer.from('Certificat de salaire 2025 — données fiscales', 'utf8');
    const enc = encryptBuffer(plain, key);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc.equals(plain)).toBe(false); // réellement chiffré
    expect(decryptBuffer(enc, key).equals(plain)).toBe(true);
  });

  it('détecte une altération (GCM auth tag)', () => {
    const enc = encryptBuffer(Buffer.from('secret'), key);
    enc[enc.length - 1] ^= 0xff; // corrompt le ciphertext
    expect(() => decryptBuffer(enc, key)).toThrow();
  });

  it('échoue avec une mauvaise clé', () => {
    const enc = encryptBuffer(Buffer.from('secret'), key);
    expect(() => decryptBuffer(enc, deriveKey('autre-cle'))).toThrow();
  });

  it('laisse passer un contenu non chiffré (compat migration)', () => {
    const plain = Buffer.from('ancien fichier en clair');
    expect(isEncrypted(plain)).toBe(false);
    expect(decryptBuffer(plain, key).equals(plain)).toBe(true);
  });

  it('deriveKey accepte une clé hex 32 octets', () => {
    const hex = '00'.repeat(32);
    expect(deriveKey(hex).length).toBe(32);
  });
});
