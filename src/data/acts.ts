/** Local floors restart at one for each act; saved enemy IDs remain explicit. */
export type ActId = 1 | 2 | 3;

export interface ActDefinition {
  id: ActId;
  name: string;
  subtitle: string;
  description: string;
  theme: 'earth' | 'astral' | 'underworld';
  accent: string;
  floors: number;
  hpScale: number;
  attackScale: number;
  blockScale: number;
}

export const ACT_IDS = [1, 2, 3] as const;

export const ACT_DEFINITIONS: Record<ActId, ActDefinition> = {
  1: {
    id: 1, name: 'じっと教の参道', subtitle: '石の教えに足を止める',
    description: '古い石門と採石場を抜け、じっと教の塔へ。まずは朝活の作法を学ぼう。',
    theme: 'earth', accent: '#d2ad68', floors: 12,
    hpScale: 1, attackScale: 1, blockScale: 1,
  },
  2: {
    id: 2, name: '星灯りの回廊', subtitle: '星を数えて、まだ寝ない',
    description: '星灯に照らされた上層回廊。硬くなった石の信徒たちが、積み上げた教義を試す。',
    theme: 'astral', accent: '#88cedf', floors: 12,
    hpScale: 1.55, attackScale: 1.25, blockScale: 1.3,
  },
  3: {
    id: 3, name: '黄泉天上の聖域', subtitle: 'ねんねの先へ、じっと登れ',
    description: '黄泉と星空が交わる塔頂の聖域。鍛えたデッキで、最後の塔主に挑もう。',
    theme: 'underworld', accent: '#c6a1ed', floors: 12,
    hpScale: 2.15, attackScale: 1.5, blockScale: 1.6,
  },
};

export function isActId(value: unknown): value is ActId {
  return value === 1 || value === 2 || value === 3;
}

/** Invalid act IDs must not silently open a different encounter pool. */
export function getActDefinition(act = 1): ActDefinition {
  if (!isActId(act)) throw new RangeError(`階層ID「${act}」は1〜3です。`);
  return ACT_DEFINITIONS[act];
}
