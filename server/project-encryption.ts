import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { ProjectPayload } from "../src/domain/project.ts";

const algorithm = "aes-256-gcm";
const nonceLength = 12;
const tagLength = 16;

function decodeKey(value: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error("DATA_ENCRYPTION_KEY debe contener exactamente 32 bytes en base64 canónico");
  }
  return key;
}

export class ProjectEncryption {
  private constructor(
    private readonly keys: ReadonlyMap<number, Buffer>,
    private readonly currentKeyVersion: number,
  ) {}

  static fromEnvironment(
    environment: NodeJS.ProcessEnv = process.env,
    required = environment.NODE_ENV === "production",
  ): ProjectEncryption | null {
    const keyEntries = environment.DATA_ENCRYPTION_KEYS
      ? environment.DATA_ENCRYPTION_KEYS.split(",").map((entry) => {
        const separator = entry.indexOf(":");
        const version = Number(entry.slice(0, separator));
        if (separator < 1 || !Number.isSafeInteger(version) || version < 1 || version > 32_767) {
          throw new Error("DATA_ENCRYPTION_KEYS debe usar el formato versión:base64");
        }
        return [version, decodeKey(entry.slice(separator + 1))] as const;
      })
      : environment.DATA_ENCRYPTION_KEY
        ? [[1, decodeKey(environment.DATA_ENCRYPTION_KEY)] as const]
        : [];
    if (keyEntries.length === 0) {
      if (required) throw new Error("DATA_ENCRYPTION_KEY es obligatorio en producción");
      return null;
    }
    const keys = new Map(keyEntries);
    if (keys.size !== keyEntries.length) throw new Error("DATA_ENCRYPTION_KEYS contiene versiones duplicadas");
    const currentKeyVersion = Number(environment.DATA_ENCRYPTION_KEY_VERSION ?? Math.max(...keys.keys()));
    if (!keys.has(currentKeyVersion)) {
      throw new Error("DATA_ENCRYPTION_KEY_VERSION no está presente en DATA_ENCRYPTION_KEYS");
    }
    return new ProjectEncryption(keys, currentKeyVersion);
  }

  encrypt(projectId: string, ownerId: string, payload: ProjectPayload): { ciphertext: Buffer; keyVersion: number } {
    const nonce = randomBytes(nonceLength);
    const cipher = createCipheriv(algorithm, this.keys.get(this.currentKeyVersion)!, nonce);
    cipher.setAAD(Buffer.from(`${projectId}:${ownerId}`, "utf8"));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), "utf8"),
      cipher.final(),
    ]);
    return {
      ciphertext: Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]),
      keyVersion: this.currentKeyVersion,
    };
  }

  decrypt(projectId: string, ownerId: string, ciphertext: Buffer, storedKeyVersion: number): ProjectPayload {
    const key = this.keys.get(storedKeyVersion);
    if (!key) throw new Error(`No se configuró la versión de clave ${storedKeyVersion}`);
    if (ciphertext.length <= nonceLength + tagLength) {
      throw new Error("Payload cifrado inválido");
    }
    const nonce = ciphertext.subarray(0, nonceLength);
    const tag = ciphertext.subarray(nonceLength, nonceLength + tagLength);
    const encrypted = ciphertext.subarray(nonceLength + tagLength);
    const decipher = createDecipheriv(algorithm, key, nonce);
    decipher.setAAD(Buffer.from(`${projectId}:${ownerId}`, "utf8"));
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as ProjectPayload;
  }
}
