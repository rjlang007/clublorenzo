import assert from "node:assert/strict";
import test from "node:test";
import { signSession, validateAuthConfiguration } from "./auth";

test("production startup rejects a missing JWT secret", () => {
  const previousEnvironment = { nodeEnv: process.env.NODE_ENV, jwtSecret: process.env.JWT_SECRET };
  try {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    assert.throws(() => validateAuthConfiguration(), /JWT_SECRET must be configured/);
  } finally {
    if (previousEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment.nodeEnv;
    if (previousEnvironment.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousEnvironment.jwtSecret;
  }
});

test("JWT secrets shorter than 32 characters are rejected", () => {
  const previousEnvironment = { nodeEnv: process.env.NODE_ENV, jwtSecret: process.env.JWT_SECRET };
  try {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "too-short";
    assert.throws(() => validateAuthConfiguration(), /at least 32 characters/);
  } finally {
    if (previousEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment.nodeEnv;
    if (previousEnvironment.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousEnvironment.jwtSecret;
  }
});

test("a configured strong secret can sign a session", () => {
  const previousEnvironment = { nodeEnv: process.env.NODE_ENV, jwtSecret: process.env.JWT_SECRET };
  try {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-production-secret-with-at-least-32-chars";
    assert.equal(typeof signSession("test-user"), "string");
  } finally {
    if (previousEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment.nodeEnv;
    if (previousEnvironment.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousEnvironment.jwtSecret;
  }
});
