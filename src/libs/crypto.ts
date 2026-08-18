import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";
import { getSsmParameter } from "./ssm";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTED_PREFIX = "ENC:";

let cachedKey: Buffer | null = null;

const resolveKey = async (): Promise<Buffer> => {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY as string;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY não configurado.");
  }

  const hex = raw.startsWith("/") ? await getSsmParameter(raw) : raw;
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY deve ser uma string hex de 64 caracteres (32 bytes).",
    );
  }

  cachedKey = key;
  return key;
};

export const encrypt = async (plaintext: string): Promise<string> => {
  const key = await resolveKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

export const decrypt = async (ciphertext: string): Promise<string> => {
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    return ciphertext;
  }

  const key = await resolveKey();
  const raw = ciphertext.slice(ENCRYPTED_PREFIX.length);
  const parts = raw.split(":");

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (parts.length !== 3 || !ivHex || !authTagHex || encryptedHex === undefined) {
    throw new Error("Formato de valor cifrado inválido.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  return (
    decipher.update(Buffer.from(encryptedHex, "hex")).toString("utf8") +
    decipher.final("utf8")
  );
};

export const isEncrypted = (value: string): boolean =>
  value.startsWith(ENCRYPTED_PREFIX);

export const hashForLookup = async (value: string): Promise<string> => {
  const key = await resolveKey();
  return createHmac("sha256", key).update(value.trim()).digest("hex");
};
