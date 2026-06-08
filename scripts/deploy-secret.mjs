import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envText = await readFile(resolve(".env.local"), "utf8");
const env = parseEnv(envText);
const key = env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY;

if (!key) {
  console.error("Missing OPENAI_API_KEY or DEEPSEEK_API_KEY in .env.local");
  process.exit(1);
}

const child = spawn(
  "npx",
  [
    "firebase-tools",
    "functions:secrets:set",
    "OPENAI_API_KEY",
    "--project",
    "versatile-radius-vlkqp",
    "--data-file",
    "-"
  ],
  { stdio: ["pipe", "inherit", "inherit"] }
);

child.stdin.end(key);
child.on("exit", code => process.exit(code ?? 1));
