// Draws many times, checks that the rules always hold and shows the
// distribution. Run: deno task stats [iterations]

import { rounds } from "./config.ts";
import { drawChain, validate } from "./lib.ts";

const ITERATIONS = Number(Deno.args[0] ?? 50_000);

for (const round of rounds) {
  const names = round.families.flat();
  const counts: Record<string, Record<string, number>> = {};
  for (const g of names) counts[g] = Object.fromEntries(names.map((r) => [r, 0]));

  let violations = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const assignments = drawChain(round.families);
    if (validate(round.families, assignments).length) violations++;
    for (const a of assignments) counts[a.giver][a.receiver]++;
  }

  console.log(`\n=== ${round.id} (${round.subtitle}), ${ITERATIONS} draws ===`);
  console.log(`Rule violations: ${violations}`);
  for (const g of names) {
    const row = names
      .filter((r) => counts[g][r] > 0)
      .map((r) => `${r} ${((counts[g][r] / ITERATIONS) * 100).toFixed(1)}%`)
      .join(", ");
    console.log(`${g.padEnd(10)} → ${row}`);
  }
}
