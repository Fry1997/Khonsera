// Stage 1 — tokeniser. Offset-preserving: every token carries its start/end in
// the original input so unknown content is held verbatim and the UI can highlight
// which substring produced which slot (brief §4).

export type TokenKind = "word" | "number" | "punct";

export interface Token {
  text: string; // original substring (case preserved)
  lower: string; // lowercased, for matching
  start: number;
  end: number; // exclusive
  kind: TokenKind;
}

// Words (incl. apostrophes/hyphens within a word), standalone numbers (incl.
// decimals and a leading £), and single punctuation marks. Whitespace is skipped
// but offsets are preserved.
const TOKEN_RE = /£?\d+(?:[.,]\d+)?|[A-Za-z][A-Za-z'’-]*|[^\sA-Za-z0-9]/g;

export function tokenise(input: string): Token[] {
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(input)) !== null) {
    const text = m[0];
    const start = m.index;
    const end = start + text.length;
    let kind: TokenKind;
    if (/^£?\d/.test(text)) kind = "number";
    else if (/^[A-Za-z]/.test(text)) kind = "word";
    else kind = "punct";
    tokens.push({ text, lower: text.toLowerCase(), start, end, kind });
  }
  return tokens;
}

// Joins the original substring covered by a token span [from, to] inclusive.
export function spanText(input: string, from: Token, to: Token): string {
  return input.slice(from.start, to.end);
}
