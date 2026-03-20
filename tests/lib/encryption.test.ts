import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '@/lib/encryption'

describe('encryption', () => {
  it('should encrypt and decrypt a string', () => {
    const plaintext = 'my-secret-token'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('should produce different ciphertext for same input', () => {
    const plaintext = 'same-input'
    const a = encrypt(plaintext)
    const b = encrypt(plaintext)
    expect(a).not.toBe(b)
  })
})
