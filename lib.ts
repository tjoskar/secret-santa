// The draw: everyone forms ONE long chain A → B → C → … → A.
// Rules:
//  - nobody gives to someone in their own family
//  - no swaps (A→B and B→A) – follows automatically from a single chain of more than 2 people
//
// Method: shuffle everyone, read the order as a circle and reject the result
// if any rule is broken. Every valid chain is then equally likely.

export interface Assignment {
  giver: string;
  receiver: string;
}

export function familyOf(families: string[][]): Map<string, number> {
  const map = new Map<string, number>();
  families.forEach((family, i) => {
    for (const name of family) {
      if (map.has(name)) throw new Error(`${name} appears twice.`);
      map.set(name, i);
    }
  });
  return map;
}

export function drawChain(
  families: string[][],
  maxAttempts = 1_000_000,
): Assignment[] {
  const family = familyOf(families);
  const names = [...family.keys()];
  if (names.length < 3) throw new Error("At least 3 people are needed.");

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const order = shuffle([...names]);
    const ok = order.every((giver, i) => {
      const receiver = order[(i + 1) % order.length];
      return family.get(giver) !== family.get(receiver);
    });
    if (ok) {
      return order.map((giver, i) => ({
        giver,
        receiver: order[(i + 1) % order.length],
      }));
    }
  }
  throw new Error("No valid chain found. Is one family too large?");
}

/** Checks every rule. Returns a list of errors (empty = ok). */
export function validate(
  families: string[][],
  assignments: Assignment[],
): string[] {
  const family = familyOf(families);
  const errors: string[] = [];
  const givers = new Set(assignments.map((a) => a.giver));
  const receivers = new Set(assignments.map((a) => a.receiver));
  if (givers.size !== family.size || receivers.size !== family.size) {
    errors.push("Everyone must give and receive exactly one gift.");
  }
  const next = new Map(assignments.map((a) => [a.giver, a.receiver]));
  for (const { giver, receiver } of assignments) {
    if (family.get(giver) === family.get(receiver)) {
      errors.push(`${giver} → ${receiver} are in the same family.`);
    }
    if (next.get(receiver) === giver) {
      errors.push(`${giver} ⇄ ${receiver} is a swap.`);
    }
  }
  // A single chain: follow the arrows from the first person, everyone must be reached.
  const start = assignments[0]?.giver;
  let current: string | undefined = start;
  let steps = 0;
  do {
    current = current === undefined ? undefined : next.get(current);
    steps++;
  } while (current !== start && current !== undefined && steps <= family.size);
  if (steps !== family.size) errors.push("It is not a single long chain.");
  return errors;
}

/** Fisher–Yates with cryptographic randomness. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function randomInt(max: number): number {
  // Reject values that would cause modulo bias.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

// No easily confused characters (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ---- Encryption (the page does the same thing in the browser) ----

const ITERATIONS = 150_000;

export async function deriveKey(
  code: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalizeCode(code)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface Entry {
  iv: string;
  ct: string;
}

export interface PageData {
  title: string;
  subtitle: string;
  salt: string;
  iterations: number;
  entries: Entry[];
}

export const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export const unb64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptEntry(
  code: string,
  salt: Uint8Array<ArrayBuffer>,
  payload: { giver: string; receiver: string },
): Promise<Entry> {
  const key = await deriveKey(code, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(payload)),
    ),
  );
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptEntries(
  code: string,
  data: PageData,
): Promise<{ giver: string; receiver: string } | null> {
  const key = await deriveKey(code, unb64(data.salt));
  for (const e of data.entries) {
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: unb64(e.iv) },
        key,
        unb64(e.ct),
      );
      return JSON.parse(new TextDecoder().decode(plain));
    } catch {
      // wrong key for this entry
    }
  }
  return null;
}

export { ITERATIONS };
