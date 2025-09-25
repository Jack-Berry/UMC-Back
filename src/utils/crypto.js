const crypto = require("crypto");

const MASTER = Buffer.from(process.env.MSG_MASTER_SECRET, "base64");
if (!MASTER || MASTER.length === 0) {
  throw new Error("MSG_MASTER_SECRET missing or empty");
}

function deriveConvKey(keySalt, conversationId) {
  return crypto.hkdfSync(
    "sha256",
    MASTER,
    keySalt,
    Buffer.from(`umc:conv:${conversationId}`),
    32
  );
}

function encryptMessage({ plaintext, key, aadObj }) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const aad = Buffer.from(JSON.stringify(aadObj));
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag, aad };
}

function decryptMessage({ ciphertext, key, iv, tag, aad }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return pt.toString("utf8");
}

module.exports = { deriveConvKey, encryptMessage, decryptMessage };
