import crypto from "node:crypto";

const textEncoder = new TextEncoder();

export function parseOrigins(value = "") {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function signRealtimeToken(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createSignature(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyRealtimeToken(token, secret) {
  if (!token || !secret) {
    return null;
  }

  const [encodedPayload, signature] = String(token).split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createSignature(encodedPayload, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    if (payload.exp && Date.now() > Number(payload.exp) * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function normalizeAuthPayload(payload = {}) {
  const role = String(payload.role || "").toLowerCase();

  if (!["office", "rider", "client"].includes(role)) {
    return null;
  }

  return {
    role,
    userId: payload.userId ? String(payload.userId) : "",
    riderId: payload.riderId ? String(payload.riderId) : "",
    orderIds: Array.isArray(payload.orderIds) ? payload.orderIds.map(String).filter(Boolean) : [],
  };
}

function createSignature(encodedPayload, secret) {
  return crypto
    .createHmac("sha256", textEncoder.encode(secret))
    .update(encodedPayload)
    .digest("base64url");
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function timingSafeEqual(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}
