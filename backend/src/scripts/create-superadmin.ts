import "dotenv/config";
import readline from "readline";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";
import { randomDefaultAvatarKey } from "../lib/defaultAvatars";

function ask(prompt: string): Promise<string> {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => input.question(prompt, (answer) => {
    input.close();
    resolve(answer.trim());
  }));
}

function askPassword(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return Promise.reject(new Error("Run this command in an interactive terminal so the password can be entered privately."));
  }

  return new Promise((resolve, reject) => {
    let password = "";
    const input = process.stdin;
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    const finish = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    };

    const onData = (character: string) => {
      if (character === "\u0003") return finish(new Error("Cancelled."));
      if (character === "\r" || character === "\n") return finish();
      if (character === "\u007f" || character === "\b") {
        password = password.slice(0, -1);
        return;
      }
      if (character >= " " && character !== "\u007f") password += character;
    };

    input.on("data", onData);
  });
}

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: "SUPERADMIN" }, select: { username: true } });
  if (existing) throw new Error(`A superadmin account (@${existing.username}) already exists. Bootstrap is only available once.`);

  const username = await ask("Superadmin username (3-20 letters, numbers, underscore): ");
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new Error("Username must be 3-20 letters, numbers, or underscores.");
  const password = await askPassword("Superadmin password (minimum 12 characters): ");
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, passwordHash, role: "SUPERADMIN", defaultAvatarKey: randomDefaultAvatarKey() },
    select: { username: true },
  });
  console.log(`Created superadmin @${user.username}. Sign in at /login and securely store the password.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Superadmin account could not be created.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
