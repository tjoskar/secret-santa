// Example. Copy to config.ts (ignored by git) and fill in the real names:
//   cp config.example.ts config.ts
//
// Configure the rounds here. Add or remove people in the families,
// then run `deno task draw <id>` to draw and build the page.

export interface Round {
  /** File name of the page: docs/<id>.html */
  id: string;
  /** Heading shown on the page */
  title: string;
  /** Subheading, e.g. which round */
  subtitle: string;
  /** People in the same family never get each other */
  families: string[][];
}

/** Where docs/ is published (GitHub Pages). Used in the messages. */
export const baseUrl = "https://tjoskar.github.io/secret-santa";

/** The text message each person gets. `url` already contains their code. */
export function message({ name, code, url }: {
  name: string;
  code: string;
  url: string;
  round: Round;
}): string {
  return `Hi ${name}! 🎅 Your secret Secret Santa code is ${code}. ` +
    `Open ${url} to see who you are buying a gift for!`;
}

export const rounds: Round[] = [
  {
    id: "round1",
    title: "Secret Santa",
    subtitle: "Round 1",
    families: [
      ["Alice", "Bob", "Carol"],
      ["Dave", "Erin"],
      ["Frank"],
    ],
  },
  {
    id: "round2",
    title: "Secret Santa",
    subtitle: "Round 2",
    families: [
      ["Grace", "Heidi"],
      ["Ivan", "Judy"],
      ["Mallory", "Niaj"],
    ],
  },
];
