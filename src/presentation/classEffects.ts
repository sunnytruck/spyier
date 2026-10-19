import { CARD_DEFINITIONS } from '../data/cards';
import type { CombatCue } from './types';

export type BattleEffectMotif = 'slash' | 'impact' | 'rock' | 'sacrifice' | 'shield' | 'poison' | 'heal' | 'strength' | 'debuff' | 'power' | 'stars' | 'sword' | 'forge' | 'knife' | 'ghost' | 'guard' | 'doom' | 'lightning' | 'frost' | 'death' | 'card';
export interface ClassEffectRoute {
  motif: BattleEffectMotif;
  sourceId: string;
  targetId: string;
  /** HUD anchors are cosmetic. They never determine the amount or target of an effect. */
  hudIds: string[];
  motion: 'lunge' | 'dart' | 'summon' | 'none';
  hpCost: boolean;
}

const INDIRECT_DAMAGE = new Set(['poison', 'loseHp', 'doom', 'thorns', 'orbLightning', 'orbFrost', 'summonDamage']);

/** Route actual engine cues, not their Japanese descriptions or a guessed resource delta. */
export function getClassEffectRoute(cue: CombatCue): ClassEffectRoute {
  const sourceId = cue.sourceId ?? 'player';
  const targetId = cue.resource === 'ostyHp' ? 'osty'
    : cue.orbIndex !== undefined && cue.kind === 'resource' ? `orb-${cue.orbIndex}`
      : cue.targetId ?? (cue.kind === 'attack' ? 'player' : sourceId);
  const definition = cue.card ? CARD_DEFINITIONS[cue.card.cardId] : undefined;
  const effects = definition ? cue.card!.upgraded ? definition.upgradedEffects : definition.effects : [];
  const fromPlayer = sourceId === 'player';
  const hpCost = cue.effect === 'loseHp';
  let motif: BattleEffectMotif;
  if (hpCost) motif = 'sacrifice';
  else if (cue.kind === 'death') motif = 'death';
  else if (cue.effect === 'orbLightning' || cue.resource === 'lightning') motif = 'lightning';
  else if (cue.effect === 'orbFrost' || cue.resource === 'frost') motif = 'frost';
  else if (cue.effect === 'poison' || cue.status === 'poison') motif = 'poison';
  else if (cue.effect === 'doom' || cue.status === 'doom') motif = 'doom';
  else if (cue.status === 'strength') motif = 'strength';
  else if (cue.resource === 'forge') motif = 'forge';
  else if (cue.resource === 'ostyHp') motif = ['guard', 'sweep'].includes(cue.resourceAction ?? '') ? 'guard' : 'ghost';
  else if (cue.effect === 'summonDamage' || sourceId === 'osty' || cue.card?.cardId === 'token_soul') motif = 'ghost';
  else if (cue.resource === 'stars' || (cue.kind !== 'impact' && effects.some((effect) => effect.type === 'starBurst'))) motif = 'stars';
  else if (cue.card?.cardId === 'token_sword') motif = 'sword';
  else if (cue.card?.cardId === 'token_knife' || cue.status === 'knifeDamage' || cue.status === 'knivesOnTurn') motif = 'knife';
  else if (cue.status === 'weak' || cue.status === 'vulnerable') motif = 'debuff';
  else if (cue.kind === 'heal') motif = 'heal';
  else if (cue.kind === 'block') motif = 'shield';
  else if (cue.kind === 'status' || cue.kind === 'power' || cue.kind === 'resource') motif = 'power';
  else if (['cardPlay', 'draw', 'discard', 'exhaust', 'generate'].includes(cue.kind)) motif = 'card';
  else if (fromPlayer && ['attack', 'impact'].includes(cue.kind) && !INDIRECT_DAMAGE.has(cue.effect ?? '')) {
    motif = ({ berserker: 'rock', assassin: 'knife', oracle: 'stars', necromancer: 'ghost', machinist: 'lightning' } as const)[cue.frame.classId ?? 'berserker'];
    // A legacy unclassified battle keeps its established slash / impact visual.
    if (!cue.frame.classId) motif = cue.kind === 'attack' ? 'slash' : 'impact';
  } else motif = cue.kind === 'attack' ? 'slash' : 'impact';

  const hudIds = new Set<string>();
  if (cue.resource && ['stars', 'forge', 'focus', 'ostyHp'].includes(cue.resource)) hudIds.add(cue.resource);
  if (cue.status === 'strength' && targetId === 'player') hudIds.add('strength');
  if (['knifeDamage', 'knivesOnTurn'].includes(cue.status ?? '') || cue.card?.cardId === 'token_knife') hudIds.add('knife');
  if (cue.card?.cardId === 'token_sword') hudIds.add('forge');
  if (cue.kind === 'cardPlay' && effects.some((effect) => effect.type === 'starBurst' || effect.type === 'gainStars')) hudIds.add('stars');
  if (cue.kind === 'cardPlay' && effects.some((effect) => effect.type === 'forge' || effect.type === 'damage' && effect.fromForge)) hudIds.add('forge');
  const direct = cue.kind === 'attack' && sourceId !== targetId && !INDIRECT_DAMAGE.has(cue.effect ?? '');
  return { motif, sourceId, targetId, hudIds: [...hudIds], hpCost,
    motion: cue.kind === 'attack' && sourceId === 'osty' ? 'summon'
      : direct ? fromPlayer && cue.frame.classId === 'assassin' ? 'dart' : 'lunge' : 'none' };
}

/** Generated token visuals come from the generated card identity, not its creator's name. */
export function generatedCardEffect(cardId: string): { motif: BattleEffectMotif; hudId?: string } {
  if (cardId === 'token_knife') return { motif: 'knife', hudId: 'knife' };
  if (cardId === 'token_sword') return { motif: 'sword', hudId: 'forge' };
  if (cardId === 'token_soul') return { motif: 'ghost', hudId: 'ostyHp' };
  return { motif: 'card' };
}
