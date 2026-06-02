// MIGRATION NOTE (EdgeOne): Encryption changed from Node.js scryptSync to Web Crypto PBKDF2.
// Existing encrypted AI API keys in the project_ai_configs table will need to be re-entered
// by users after deployment to EdgeOne.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 12 bytes is the GCM standard, but we use 16 for compatibility with existing data

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("ai-config-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

let _keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (_keyPromise) return _keyPromise;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not configured. Please set it in EdgeOne project settings.");
  }
  _keyPromise = deriveKey(secret);
  // Don't cache rejections — allows retry when env vars become available
  _keyPromise.catch(() => { _keyPromise = null; });
  return _keyPromise;
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );
  // Combine iv + encrypted (tag is appended by AES-GCM in subtle)
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  // Use TextDecoder('latin1') to safely map bytes→binary string without
  // spreading large arrays into String.fromCharCode (which can overflow)
  return btoa(new TextDecoder("latin1").decode(combined));
}

export async function decrypt(encoded: string): Promise<string> {
  const key = await getKey();
  const buf = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const iv = buf.slice(0, IV_LENGTH);
  const encrypted = buf.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}
