// Rebuilds the pages in docs/ from a new template.html but KEEPS the draw
// (same encrypted data, so codes that were already sent keep working).
//
//   deno task rebuild

import { rounds } from "./config.ts";

const template = await Deno.readTextFile("template.html");
const marker = "/*__DATA__*/null";
if (!template.includes(marker)) throw new Error(`Cannot find ${marker} in template.html`);

for (const round of rounds) {
  const path = `docs/${round.id}.html`;
  let html: string;
  try {
    html = await Deno.readTextFile(path);
  } catch {
    console.log(`– ${path} does not exist (not drawn yet), skipping.`);
    continue;
  }
  const line = html.match(/const DATA = (\{.*\});\s*$/m);
  if (!line) throw new Error(`No draw found in ${path}`);
  const data = JSON.parse(line[1]);
  // The headings may have changed in config.ts – everything else stays untouched.
  data.title = round.title;
  data.subtitle = round.subtitle;
  await Deno.writeTextFile(path, template.replace(marker, JSON.stringify(data)));
  console.log(`✔ Rebuilt ${path} (${data.entries.length} people, same codes).`);
}
