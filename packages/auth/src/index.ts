import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { Redis } from 'ioredis';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-prod';
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AccessTokenPayload {
  sub: string;
  email?: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  tokenId: string;
  sub: string;
}

export function issueTokens(user: { sub: string; email?: string }) {
  const jti = uuidv4();
  const accessToken = jwt.sign({ sub: user.sub, email: user.email, jti }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

  const refreshTokenId = uuidv4();
  const refreshToken = jwt.sign({ tokenId: refreshTokenId, sub: user.sub }, JWT_SECRET, {
    expiresIn: `${REFRESH_TOKEN_TTL_SECONDS}s`,
  });

  return { accessToken, refreshToken, refreshTokenId, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, JWT_SECRET) as RefreshTokenPayload;
}

export async function revokeAccessToken(redis: Redis, jti: string) {
  // Store in blocklist until token naturally expires (15 min)
  await redis.set(`session:blocklist:${jti}`, '1', 'EX', 60 * 20);
}

// AES-256-GCM encryption for OAuth tokens stored in DB
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY ?? 'dev-key-32-bytes-change-in-prod!!';
  return Buffer.from(key.slice(0, 32), 'utf8');
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid ciphertext');
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}
