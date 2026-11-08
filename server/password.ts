import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const algorithm = "scrypt";
const keyLength = 64;
const cost = 32_768;
const blockSize = 8;
const parallelization = 1;
const maxmem = 64 * 1024 * 1024;

function isBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

async function deriveKey(password: string, salt: string, length: number, options?: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, { ...options, maxmem }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const hash = await deriveKey(password, salt, keyLength, { N: cost, r: blockSize, p: parallelization });
  return [algorithm, cost, blockSize, parallelization, salt, hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length === 6 && parts[0] === algorithm) {
      const [, costText, blockSizeText, parallelizationText, salt, expectedText] = parts;
      const options = {
        N: Number(costText),
        r: Number(blockSizeText),
        p: Number(parallelizationText),
      };
      if (
        !Number.isSafeInteger(options.N) || options.N < 2 || options.N > cost ||
        !Number.isSafeInteger(options.r) || options.r < 1 || options.r > blockSize ||
        !Number.isSafeInteger(options.p) || options.p < 1 || options.p > parallelization ||
        !salt || !expectedText || !isBase64Url(salt) || !isBase64Url(expectedText)
      ) return false;

      const expected = Buffer.from(expectedText, "base64url");
      if (expected.length !== keyLength) return false;
      const actual = await deriveKey(password, salt, expected.length, options);
      return timingSafeEqual(expected, actual);
    }

    // Compatibilidad con las cuentas creadas antes de versionar el formato.
    const [legacySalt, expectedHex, ...extra] = stored.split(":");
    if (extra.length || !legacySalt || !/^[a-f0-9]{32}$/i.test(legacySalt) || !/^[a-f0-9]{128}$/i.test(expectedHex)) {
      return false;
    }
    const expected = Buffer.from(expectedHex, "hex");
    const actual = await deriveKey(password, legacySalt, expected.length);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
