export function createRateLimiter({ limit = 120, windowMs = 60_000 } = {}) {
  const buckets = new Map();

  return function rateLimit(request, response, next) {
    const key = request.ip || request.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    response.setHeader("X-RateLimit-Limit", String(limit));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      response.status(429).json({ message: "Too many publish requests." });
      return;
    }

    next();
  };
}
