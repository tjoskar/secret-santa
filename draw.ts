// Draws a round and builds docs/<id>.html.
//
//   deno task draw round1           draw round 1
//   deno task draw round1 --force   redraw (codes already sent stop working!)
//
// The script NEVER prints who got whom, only name + code.
// The messages are also saved to sms/<id>.txt (ignored by git).

import { baseUrl, message, rounds } from "./config.ts";
import {
  b64,
  drawChain,
  encryptEntry,
  ITERATIONS,
  type PageData,
  randomCode,
  shuffle,
  validate,
} from "./lib.ts";

const [id, ...flags] = Deno.args;
const force = flags.includes("--force");
const round = rounds.find((r) => r.id === id);

if (!round) {
  console.error(
    `Pick a round: ${rounds.map((r) => r.id).join(" | ")}\n` +
      `e.g. deno task draw ${rounds[0].id}`,
  );
  Deno.exit(1);
}

const pagePath = `docs/${round.id}.html`;
if (!force && (await exists(pagePath))) {
  console.error(
    `${pagePath} already exists. Redrawing makes the codes you have sent stop working.\n` +
      `Run with --force if you really want that.`,
  );
  Deno.exit(1);
}

const assignments = drawChain(round.families);
const errors = validate(round.families, assignments);
if (errors.length) throw new Error(errors.join("\n"));

const used = new Set<string>();
const codes = new Map<string, string>();
for (const { giver } of assignments) {
  let code: string;
  do code = randomCode(); while (used.has(code));
  used.add(code);
  codes.set(giver, code);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const entries = await Promise.all(
  assignments.map((a) => encryptEntry(codes.get(a.giver)!, salt, a)),
);

const data: PageData = {
  title: round.title,
  subtitle: round.subtitle,
  salt: b64(salt),
  iterations: ITERATIONS,
  entries: shuffle(entries), // the order must not reveal the chain
};

const template = await Deno.readTextFile("template.html");
const marker = "/*__DATA__*/null";
if (!template.includes(marker)) throw new Error(`Cannot find ${marker} in template.html`);
await Deno.mkdir("docs", { recursive: true });
await Deno.writeTextFile(pagePath, template.replace(marker, JSON.stringify(data)));
await writeIndex();

// Messages, sorted by name so that the order reveals nothing.
const url = `${baseUrl}/${round.id}.html`;
const lines = [...codes.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, code]) =>
    `${name} (${code}):\n${message({ name, code, url: `${url}#${code}`, round })}\n`
  );

await Deno.mkdir("sms", { recursive: true });
await Deno.writeTextFile(`sms/${round.id}.txt`, lines.join("\n"));

console.log(lines.join("\n"));
console.log(`✔ Built ${pagePath} (${assignments.length} people, one long chain).`);
console.log(`✔ Codes saved to sms/${round.id}.txt`);

async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function writeIndex() {
  const built = [];
  for (const r of rounds) if (await exists(`docs/${r.id}.html`)) built.push(r);
  const links = built
    .map((r) => `<a class="btn" href="${r.id}.html">${r.subtitle}</a>`)
    .join("\n      ");
  const html = (await Deno.readTextFile("template-index.html")).replace(
    "<!--__LINKS__-->",
    links,
  );
  await Deno.writeTextFile("docs/index.html", html);
}
