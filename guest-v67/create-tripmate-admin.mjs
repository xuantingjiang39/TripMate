#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";

const input = await new Promise((resolve, reject) => {
  let value = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => value += chunk);
  process.stdin.on("end", () => resolve(value));
  process.stdin.on("error", reject);
});
const [rawEmail = "", rawName = "", rawPassword = ""] = String(input).split(/\r?\n/);
const email = rawEmail.trim().toLowerCase();
const name = rawName.trim();
const password = rawPassword;
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) throw new Error("邮箱格式不正确。");
if (name.length < 2 || name.length > 24) throw new Error("昵称请填写 2—24 个字符。");
if (password.length < 8 || password.length > 128) throw new Error("密码至少 8 位，最多 128 位。");

const dataDirectory = process.env.TRIPMATE_DATA_DIR || "/var/lib/tripmate";
const accountFile = join(dataDirectory, "accounts.json");
await mkdir(dataDirectory, { recursive: true });
let data = { version: 1, users: [], sessions: [] };
try {
  const saved = JSON.parse(await readFile(accountFile, "utf8"));
  data = { version: 1, users: Array.isArray(saved.users) ? saved.users : [], sessions: Array.isArray(saved.sessions) ? saved.sessions : [] };
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const salt = randomBytes(16).toString("hex");
const passwordHash = scryptSync(password, salt, 64).toString("hex");
let user = data.users.find(item => String(item.email).toLowerCase() === email);
if (user) {
  user.name = name;
  user.role = "admin";
  user.aiEnabled = true;
  user.passwordSalt = salt;
  user.passwordHash = passwordHash;
  user.updatedAt = new Date().toISOString();
  data.sessions = data.sessions.filter(item => item.userId !== user.id);
} else {
  user = { id: randomUUID(), email, name, role: "admin", aiEnabled: true, passwordSalt: salt, passwordHash, createdAt: new Date().toISOString(), state: {}, aiRequests: 0 };
  data.users.push(user);
}

const temporary = `${accountFile}.${process.pid}.tmp`;
await writeFile(temporary, JSON.stringify(data), { encoding: "utf8", mode: 0o600 });
await rename(temporary, accountFile);
process.stdout.write(`管理员账号已创建：${email}\n`);
