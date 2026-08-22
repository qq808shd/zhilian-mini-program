const { createHmac, timingSafeEqual } = require("node:crypto");

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function issueSession(userId, secret, ttlSeconds, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000);
  const payload = encode({ sub: userId, iat: issuedAt, exp: issuedAt + ttlSeconds });
  return `${payload}.${sign(payload, secret)}`;
}

function verifySession(token, secret, now = Date.now()) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = sign(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.sub || !decoded.exp || decoded.exp <= Math.floor(now / 1000)) return null;
    return decoded;
  } catch (error) {
    return null;
  }
}

module.exports = { issueSession, verifySession };
