// Shared number-word map for duration / party-size recognisers.
export const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  a: 1, an: 1, couple: 2, "a couple": 2,
};

export function wordToNumber(word: string): number | null {
  const n = NUMBER_WORDS[word.toLowerCase()];
  return n ?? (/^\d+$/.test(word) ? parseInt(word, 10) : null);
}
