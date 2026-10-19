/** A seeded PRNG: its entire internal state fits in the serializable combat state. */
export function seedToState(seed: string): number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
  }
  return value >>> 0;
}

export function nextRandom(state: number): { state: number; value: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { state: nextState, value: ((value ^ (value >>> 14)) >>> 0) / 4294967296 };
}

export function shuffle<T>(values: T[], initialState: number): { values: T[]; rngState: number } {
  const result = [...values];
  let rngState = initialState;
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = nextRandom(rngState);
    rngState = random.state;
    const other = Math.floor(random.value * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return { values: result, rngState };
}
