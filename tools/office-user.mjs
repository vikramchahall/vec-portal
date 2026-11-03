#!/usr/bin/env node
/**
 * Add, update or remove an office account (no sign-up, no reset email — BRD-01 14.1).
 * Run on the server from the current release folder:
 *
 *   cd /opt/vec/releases/current
 *   sudo -u vec node tools/office-user.mjs add owner@example.in "Vikram S." owner
 *   sudo -u vec node tools/office-user.mjs add hr@example.in "HR" hr
 *   sudo -u vec node tools/office-user.mjs remove hr@example.in
 *   sudo -u vec node tools/office-user.mjs list
 *
 * The password is asked for (not typed on the command line) and stored as a bcrypt hash in
 * /opt/vec/shared/office-users.json (or OFFICE_USERS_FILE).
 */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { createRequire } from "node:module";
import readline from "node:readline";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const FILE = process.env.OFFICE_USERS_FILE ?? "/opt/vec/shared/office-users.json";
const [cmd, emailRaw, name, role] = process.argv.slice(2);

const load = () => { try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return []; } };
const save = (users) => {
  writeFileSync(FILE + ".tmp", JSON.stringify(users, null, 2) + "\n", { mode: 0o600 });
  renameSync(FILE + ".tmp", FILE);
};

function askHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}

const users = load();
if (cmd === "list") {
  for (const u of users) console.log(`${u.role.padEnd(6)} ${u.email}  (${u.name})`);
} else if (cmd === "remove" && emailRaw) {
  save(users.filter((u) => u.email !== emailRaw.toLowerCase()));
  console.log(`removed ${emailRaw}`);
} else if (cmd === "add" && emailRaw && name && (role === "owner" || role === "hr")) {
  const email = emailRaw.toLowerCase();
  const p1 = await askHidden("New password (min 10 characters): ");
  if (p1.length < 10) { console.error("Password too short"); process.exit(1); }
  const p2 = await askHidden("Repeat password: ");
  if (p1 !== p2) { console.error("Passwords do not match"); process.exit(1); }
  const hash = bcrypt.hashSync(p1, 12);
  save([...users.filter((u) => u.email !== email), { email, name, role, hash }]);
  console.log(`saved ${role} account ${email}`);
} else {
  console.log('usage: office-user.mjs add <email> "<name>" <owner|hr> | remove <email> | list');
  process.exit(2);
}
