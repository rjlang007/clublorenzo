import "dotenv/config";
import readline from "readline";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";

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
  const username = await ask("Existing superadmin username: ");
  const account = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, role: true },
  });
  if (!account || account.role !== "SUPERADMIN") {
    throw new Error("No superadmin account with that username was found; no password was changed.");
  }

  const password = await askPassword("New password (minimum 12 characters): ");
  if (password.length < 12) throw new Error("Use a password with at least 12 characters.");
  const confirmation = await askPassword("Re-enter the new password: ");
  if (password !== confirmation) throw new Error("The passwords did not match; no password was changed.");

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: account.id },
    data: { passwordHash },
  });
  console.log(`Password updated for superadmin @${account.username}. The password was not displayed.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Superadmin password could not be updated.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
