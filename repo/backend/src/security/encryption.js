const crypto = require("crypto");
const env = require("../config/env");

const IV_LENGTH = 12;

function deriveKey() {
  return crypto.createHash("sha256").update(env.PROFILE_ENCRYPTION_KEY).digest();
}

function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return null;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decrypt(ciphertext) {
  if (!ciphertext) {
    return null;
  }

  const [ivPart, tagPart, encryptedPart] = ciphertext.split(":");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Malformed encrypted payload");
  }

  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const encrypted = Buffer.from(encryptedPart, "base64");
  const key = deriveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

module.exports = {
  encrypt,
  decrypt
};
