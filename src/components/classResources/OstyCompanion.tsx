import { useCallback, useState } from 'react';
import type { CombatState } from '../../types/game';
import type { CombatCue } from '../../presentation/types';
import { getSummonView } from '../../engine/combat/resourceView';
import { OstyArt } from '../CharacterArt';
import { ResourceDetails } from './ResourceDetails';

export function OstyCompanion({ state, cue }: { state: CombatState; cue?: CombatCue | null }) {
  const view = getSummonView(state);
  const dissolving = !view.active && cue?.resource === 'ostyHp' && ((cue.amount ?? 0) < 0 || ['guard', 'sweep', 'vanish'].includes(cue.resourceAction ?? ''));
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <>
    <button type="button" className={`osty-companion ${view.active ? 'osty-active' : dissolving ? 'osty-dissolving' : 'osty-absent'}`}
      data-battle-actor="osty" data-osty-state={view.active ? 'active' : dissolving ? 'dissolving' : 'absent'}
      title={`岩霊オスティ HP ${view.hp}。${view.guardRule} ${view.attackRule}`}
      aria-label={`岩霊オスティ、${view.active ? '召喚中' : dissolving ? '消滅' : '未召喚'}、HP ${view.hp}。護衛と攻撃の詳細を表示`}
      onClick={() => setOpen(true)}>
      <span className="osty-unit-name">岩霊オスティ</span>
      <span className="resource-motion"><OstyArt active={view.active || dissolving} /></span>
      <span className="osty-unit-hp" data-resource-hud="ostyHp"><span>HP</span><b>{view.hp}</b></span>
      <span className="osty-unit-state">{view.active ? '護衛中' : dissolving ? '消滅' : '未召喚'}</span>
    </button>
    {open && <ResourceDetails title="岩霊オスティ" onClose={close}>
      <p>現在HP <strong>{view.hp}</strong> · {view.active ? '召喚中' : '未召喚'}</p>
      <dl><div><dt>護衛</dt><dd>{view.guardRule}</dd></div><div><dt>攻撃</dt><dd>{view.attackRule}</dd></div></dl>
      <p>召喚効果は岩霊のHPを増やします。自動攻撃は行わず、岩霊に攻撃させるカードで命令します。</p>
      {view.commands.length > 0 && <><h3>手札の命令カード</h3><ul>{view.commands.map((command, index) => <li key={`${command.cardUid}-${index}`}><strong>{command.name}</strong>：{command.amount}ダメージ{command.plusSummonHp ? `（基礎${command.baseAmount}＋岩霊HP ${view.hp}）` : ''}{!view.active && ' · 岩霊不在のため不発'}</li>)}</ul></>}
      <p>破滅は敵のターン開始時、毒を処理した後の敵HP以上に蓄積していれば発動し、ブロックを無視して撃破します。</p>
    </ResourceDetails>}
  </>;
}
