export function getCorsOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ORIGIN;
  if (!configuredOrigins && process.env.NODE_ENV === "production") {
    throw new Error("CORS_ORIGIN must be configured with the public application origin in production.");
  }

  const origins = (configuredOrigins || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.includes("*")) {
    throw new Error("CORS_ORIGIN must not allow every origin.");
  }
  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN must contain at least one application origin.");
  }
  if (process.env.NODE_ENV === "production" && origins.some((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== "https:" || parsed.origin !== origin;
    } catch {
      return true;
    }
  })) {
    throw new Error("Every production CORS_ORIGIN must be a valid HTTPS origin.");
  }

  return origins;
}
