import { assert, assertEquals } from "jsr:@std/assert@1";
import { rounds } from "./config.example.ts";
import { b64, decryptEntries, drawChain, encryptEntry, normalizeCode, validate } from "./lib.ts";

Deno.test("every round produces valid chains", () => {
  for (const round of rounds) {
    for (let i = 0; i < 2000; i++) {
      assertEquals(validate(round.families, drawChain(round.families)), []);
    }
  }
});

Deno.test("validate finds swaps and family clashes", () => {
  const families = [["A", "B"], ["C"], ["D"]];
  const errors = validate(families, [
    { giver: "A", receiver: "B" },
    { giver: "B", receiver: "A" },
    { giver: "C", receiver: "D" },
    { giver: "D", receiver: "C" },
  ]);
  assert(errors.some((e) => e.includes("same family")));
  assert(errors.some((e) => e.includes("swap")));
  assert(errors.some((e) => e.includes("chain")));
});

Deno.test("a family that is too large cannot be drawn", () => {
  let threw = false;
  try {
    drawChain([["A", "B", "C"], ["D"]], 1000);
  } catch {
    threw = true;
  }
  assert(threw);
});

Deno.test("the right code decrypts, a wrong code does not", async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const entries = [
    await encryptEntry("ABCDE", salt, { giver: "Alice", receiver: "Bob" }),
    await encryptEntry("XYZ23", salt, { giver: "Bob", receiver: "Carol" }),
  ];
  const data = { title: "", subtitle: "", salt: b64(salt), iterations: 0, entries };
  assertEquals(await decryptEntries("xyz-23", data), { giver: "Bob", receiver: "Carol" });
  assertEquals(await decryptEntries("ABCDF", data), null);
});

Deno.test("codes are normalized", () => {
  assertEquals(normalizeCode(" ab-c d2 "), "ABCD2");
});
