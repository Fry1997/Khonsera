// People-reference recognition (Layer 5). Recognises the SHAPE of a person
// reference, never the identity — resolution belongs to contacts/standing-facts
// at runtime. Every match carries requires_runtime_resolution.
//
// Discipline (handback §9): NOT every capitalised word is a person. Place names,
// day names and brands are capitalised too. So names are only claimed when:
//   - introduced by a person-introducing verb/operator (meeting/call/dinner/with),
//     captured as a 1-2 word Title-Case run; OR
//   - introduced by from/to/for AND the word is a known first name (so transport
//     "from Wellingborough" / "to Liverpool" is never mistaken for a person).
// Trailing day/month words are trimmed so "with Mark Friday" → "Mark", not
// "Mark Friday".

import type { PatternMatch } from "./types";

type PersonKind =
  | "named_person"
  | "possessive_person"
  | "family_reference"
  | "work_reference"
  | "role_reference";

const FAMILY = ["my wife", "my husband", "my partner", "my son", "my daughter", "my mum", "my dad", "my mother", "my father"];
const WORK = ["the client", "the customer", "the team", "the sales team", "my manager", "my colleague", "my boss"];
const ROLE = ["the organiser", "the organizer", "the driver", "the host"];
const POSSESSIVE_RE = /\b([A-Z][a-z]+)['’]s\s+(mum|dad|mother|father|wife|husband|partner|son|daughter|colleague|manager|boss)\b/g;

// Person-introducing words. A name (1-2 Title-Case words) immediately after one
// of these is a person reference. Matched case-insensitively (often sentence-
// initial: "Meeting John", "Call Dave", "Email Jane"). "and"/"&" are deliberately
// excluded — they'd steal "Benny" from "Frankie & Benny's". We match the
// introducer ALONE then read the following name manually, so overlapping
// introducers ("meeting with Sarah") don't consume each other.
const PERSON_INTRODUCER_RE =
  /\b(?:meeting|meet|call|calling|dinner|lunch|breakfast|drinks|see|seeing|with|email|emailing|send|sending|text|texting|message|messaging|forward|forwarding|notify|ping)\b/gi;
// from/to/for introduce a person ONLY when the following word is a known first
// name — otherwise they're place/time operators (transport, deadlines).
const NAME_OP_RE = /\b(?:from|to|for)\b/gi;

// Reads up to `maxWords` consecutive Title-Case words starting at char offset
// `from` (skipping leading spaces). Returns the joined name + its start offset.
function readNameAt(input: string, from: number, maxWords: number): { name: string; start: number } | null {
  const re = /\s*([A-Z][a-z]+)/y;
  re.lastIndex = from;
  const words: string[] = [];
  let start = -1;
  let m: RegExpExecArray | null;
  while (words.length < maxWords && (m = re.exec(input)) !== null) {
    if (start === -1) start = m.index + m[0].length - m[1].length;
    words.push(m[1]);
  }
  return words.length > 0 ? { name: words.join(" "), start } : null;
}

// Words that look like names by capitalisation but are days/months — trimmed off.
const NOT_A_NAME = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "mon", "tue", "tues", "wed", "thu", "thur", "thurs", "fri", "sat", "sun",
  "today", "tomorrow", "yesterday", "tonight", "weekend",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  "morning", "afternoon", "evening", "night", "lunchtime",
]);

// A small curated lexicon of common first names — the disambiguator for the
// from/to/for case (handback §2.1). Deliberately first names only; never place
// names. Grow this with real-input testing, not cleverness.
const FIRST_NAMES = new Set([
  "ricky", "jane", "dave", "david", "john", "sarah", "mark", "mike", "michael",
  "james", "tom", "thomas", "sam", "ben", "jack", "harry", "george", "paul",
  "peter", "simon", "chris", "dan", "daniel", "matt", "matthew", "luke", "adam",
  "rob", "robert", "steve", "stephen", "steven", "andy", "andrew", "nick",
  "nicholas", "alex", "joe", "joseph", "will", "william", "ed", "edward",
  "charlie", "charles", "jamie", "ryan", "sean", "shaun", "gary", "lee", "phil",
  "philip", "richard", "rich", "greg", "craig", "kevin", "neil", "ian", "carl",
  "emma", "kate", "katie", "laura", "lucy", "hannah", "sophie", "jess",
  "jessica", "anna", "amy", "lisa", "claire", "clare", "rachel", "helen",
  "jenny", "jen", "becky", "rebecca", "beth", "megan", "chloe", "ellie",
  "grace", "olivia", "amelia", "charlotte", "ruth", "louise", "natalie",
  "michelle", "nicola", "victoria", "vicky", "gemma", "holly", "abbie",
  "ricki", "rikki", "mum", "dad",
]);

function phraseMatches(
  input: string,
  phrases: string[],
  kind: PersonKind,
  confidence: PatternMatch["confidence"],
): PatternMatch[] {
  const out: PatternMatch[] = [];
  const lower = input.toLowerCase();
  for (const phrase of phrases) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      const end = idx + phrase.length;
      const before = idx === 0 || /\W/.test(input[idx - 1]);
      const after = end === input.length || /\W/.test(input[end]);
      if (before && after) {
        out.push({
          type: "person",
          source_text: input.slice(idx, end),
          source_range: { start: idx, end },
          normalised_value: input.slice(idx, end),
          confidence,
          fuzzy: false,
          range: false,
          granularity: "exact",
          meta: { kind, requires_runtime_resolution: true },
        });
      }
      idx = lower.indexOf(phrase, end);
    }
  }
  return out;
}

// Trims trailing day/month words from a captured Title-Case run and returns the
// surviving prefix (or null if nothing name-like remains).
function trimName(name: string): string | null {
  const words = name.split(/\s+/);
  while (words.length > 0 && NOT_A_NAME.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.length > 0 ? words.join(" ") : null;
}

function namedMatch(name: string, start: number, kind: PersonKind = "named_person"): PatternMatch {
  return {
    type: "person",
    source_text: name,
    source_range: { start, end: start + name.length },
    normalised_value: name,
    confidence: "medium",
    fuzzy: false,
    range: false,
    granularity: "exact",
    meta: { kind, requires_runtime_resolution: true },
  };
}

export function recognisePeople(input: string): PatternMatch[] {
  const out: PatternMatch[] = [
    ...phraseMatches(input, FAMILY, "family_reference", "high"),
    ...phraseMatches(input, WORK, "work_reference", "medium"),
    ...phraseMatches(input, ROLE, "role_reference", "medium"),
  ];

  let m: RegExpExecArray | null;
  POSSESSIVE_RE.lastIndex = 0;
  while ((m = POSSESSIVE_RE.exec(input)) !== null) {
    out.push({
      type: "person",
      source_text: m[0],
      source_range: { start: m.index, end: m.index + m[0].length },
      normalised_value: m[0],
      confidence: "medium",
      fuzzy: false,
      range: false,
      granularity: "exact",
      meta: { kind: "possessive_person" as PersonKind, requires_runtime_resolution: true },
    });
  }

  const seen = new Set<number>();
  const add = (match: PatternMatch) => {
    if (seen.has(match.source_range.start)) return;
    seen.add(match.source_range.start);
    out.push(match);
  };

  // Verb/with-introduced names (1-2 Title-Case words; day/month tail trimmed).
  PERSON_INTRODUCER_RE.lastIndex = 0;
  while ((m = PERSON_INTRODUCER_RE.exec(input)) !== null) {
    const read = readNameAt(input, m.index + m[0].length, 2);
    if (!read) continue;
    const name = trimName(read.name);
    if (!name) continue;
    add(namedMatch(name, read.start));
  }

  // from/to/for-introduced names, gated by the first-name lexicon so transport
  // origins/destinations are never mis-tagged.
  NAME_OP_RE.lastIndex = 0;
  while ((m = NAME_OP_RE.exec(input)) !== null) {
    const read = readNameAt(input, m.index + m[0].length, 1);
    if (!read || !FIRST_NAMES.has(read.name.toLowerCase())) continue;
    add(namedMatch(read.name, read.start));
  }

  return out;
}
