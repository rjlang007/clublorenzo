import assert from "node:assert/strict";
import test from "node:test";
import { getCorsOrigins } from "./corsOrigins";

function withProductionOrigins<T>(origins: string | undefined, run: () => T): T {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOrigins = process.env.CORS_ORIGIN;
  try {
    process.env.NODE_ENV = "production";
    if (origins === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = origins;
    return run();
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousOrigins === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previousOrigins;
  }
}

test("production CORS accepts a comma-separated list of exact HTTPS origins", () => {
  const origins = withProductionOrigins("https://club.example,https://admin.example", getCorsOrigins);
  assert.deepEqual(origins, ["https://club.example", "https://admin.example"]);
});

test("production CORS rejects missing, wildcard, insecure, and path-based origins", () => {
  withProductionOrigins(undefined, () => assert.throws(getCorsOrigins, /CORS_ORIGIN must be configured/));
  withProductionOrigins("*", () => assert.throws(getCorsOrigins, /must not allow every origin/));
  withProductionOrigins("http://club.example", () => assert.throws(getCorsOrigins, /valid HTTPS origin/));
  withProductionOrigins("https://club.example/admin", () => assert.throws(getCorsOrigins, /valid HTTPS origin/));
});
