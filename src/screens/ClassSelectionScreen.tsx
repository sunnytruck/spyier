import { useCallback, useState, type CSSProperties } from 'react';
import { CLASS_DEFINITIONS, CLASS_IDS } from '../data/classes';
import { CARD_DEFINITIONS } from '../data/cards';
import { RELIC_DEFINITIONS } from '../data/relics';
import type { ClassId } from '../types/game';
import { ChoiceCard } from '../components/ChoiceCard';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { RelicIcon } from '../components/RelicIcon';
import { RockDeity } from '../components/CharacterArt';
import { WorldScene } from '../components/world/WorldScene';
import { orbEffectValue, orbSlotCount } from '../engine/combat/resources';
import '../styles/class-cast.css';

const casting: Record<ClassId, { accent: string; haze: string; motto: string; path: string }> = {
  berserker: { accent: '#e9b17e', haze: '#a95b352d', motto: '己の岩を、拳で拓く。', path: 'M27 61 23 41l9-8 8 4 2-16h9l4 16 9-2 10 9-5 24-16 12-19-6ZM34 43l4 16m9-20 2 20m11-17-3 17M34 74l-6 10m36-9 6 8' },
  assassin: { accent: '#b6ca92', haze: '#5c86492c', motto: '静かな一手が、命を奪う。', path: 'm25 75 39-54 9-5-1 13-39 54ZM42 56l14 10M20 80l12 8M61 26l8 8M22 37c-4-7 2-13 7-18 5 5 11 11 7 18-3 6-11 6-14 0Z' },
  oracle: { accent: '#f1d88d', haze: '#ac96432b', motto: '星を読み、聖剣を鍛えよ。', path: 'm48 10 8 20 22 3-17 15 5 22-18-12-18 12 5-22-17-15 22-3ZM48 46v36M35 71h26M27 88h42' },
  necromancer: { accent: '#beb0e3', haze: '#78639b38', motto: '彼岸の教えは、ひとりではない。', path: 'M29 76c-12-9-9-22 1-34 9-10 15-16 17-28 17 11 27 24 28 40 0 15-12 27-27 27ZM38 50l-3 11m23-11 3 11M40 70h16M24 86l8-6m34 0 8 6' },
  machinist: { accent: '#a8dce2', haze: '#408c9b32', motto: '祈りと回路で、空を鳴らす。', path: 'm48 15 26 16v34L48 81 22 65V31ZM48 26v43M28 35l20 12 20-12M48 47 29 61m19-14 19 14M45 30l-9 16h10l-4 16 17-22H48l5-10' },
};

function ClassCrest({ classId }: { classId: ClassId }) {
  return <svg viewBox="0 0 96 96" className="cast-crest" aria-hidden="true"><path d="m48 4 31 17 12 30-16 29-27 12-28-12L5 51l12-30Z" fill="currentColor" opacity=".06"/><path d="m48 5 29 16 13 30-15 28-27 12-27-12L6 51l13-30Z" fill="none" stroke="currentColor" opacity=".45"/><path d={casting[classId].path} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function ClassSelectionScreen({ selected, onSelect, onStart, onBack }: {
  selected: ClassId;
  onSelect: (id: ClassId) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const [showDeck, setShowDeck] = useState(false);
  const closeDeck = useCallback(() => setShowDeck(false), []);
  const job = CLASS_DEFINITIONS[selected];
  const relic = RELIC_DEFINITIONS[job.starterRelicId];
  const theme = casting[selected];
  const starterCounts = new Map<string, number>();
  for (const id of job.starterDeck) starterCounts.set(id, (starterCounts.get(id) ?? 0) + 1);
  const countType = (type: 'attack' | 'skill' | 'power') => job.starterDeck.filter((id) => CARD_DEFINITIONS[id].type === type).length;
  return <main className="class-selection-screen class-cast-screen" data-class-id={selected} style={{ '--cast-accent': theme.accent, '--cast-haze': theme.haze } as CSSProperties}>
    <WorldScene variant="title" className="cast-temple" />
    <header className="cast-heading"><div><p className="eyebrow">じっと教の五つの道</p><h1>その岩に、宿す教えを。</h1></div><button type="button" className="text-button cast-back" onClick={onBack}>タイトルへ戻る<Icon name="arrow" size={16} /></button></header>
    <div className="cast-stage">
      <div className="cast-figure-stage">
        <div className="cast-sanctuary-ring" aria-hidden="true"><ClassCrest classId={selected} /></div>
        <figure className="cast-portrait" data-selected-character={selected} key={selected}>
          <RockDeity classId={selected} />
          <figcaption><span>岩尊けいと</span><p>{theme.motto}</p></figcaption>
        </figure>
        <nav className="cast-professions" aria-label="職業を選択">
          {CLASS_IDS.map((id) => <button type="button" key={id} className={`cast-profession${id === selected ? ' is-selected' : ''}`} style={{ '--crest-color': casting[id].accent } as CSSProperties} aria-label={CLASS_DEFINITIONS[id].displayName} title={CLASS_DEFINITIONS[id].displayName} aria-pressed={id === selected} onClick={() => onSelect(id)}><ClassCrest classId={id} /><span>{CLASS_DEFINITIONS[id].glyph}</span></button>)}
        </nav>
      </div>
      <section className="cast-identity" aria-label={`${job.displayName}の詳細`}>
        <p className="cast-identity-kicker">岩尊けいと · {String(CLASS_IDS.indexOf(selected) + 1).padStart(2, '0')}</p>
        <div className="cast-name"><h2>{job.displayName}</h2><span className="cast-starting-health"><Icon name="heart" size={19} /><b>{job.maxHp}</b><small>初期HP</small></span></div>
        <p className="cast-description">{job.description}</p>
        <p className="cast-resources">{job.resourceSummary}</p>
        {relic && <div className="cast-relic"><RelicIcon id={relic.id} size={42} /><div><small>初期レリック</small><h3>{relic.name}</h3><p>{relic.description}</p></div></div>}
        <div className="cast-deck-summary"><div><span>初期デッキ <b>{job.starterDeck.length}枚</b></span><small>攻撃 {countType('attack')} · スキル {countType('skill')}{countType('power') > 0 ? ` · パワー ${countType('power')}` : ''}</small></div><button type="button" className="cast-deck-details" onClick={() => setShowDeck(true)}><Icon name="book" size={18} />初期カードと教えを見る</button></div>
        <button type="button" className="primary-button cast-start" onClick={onStart}>この職業で探索を始める<Icon name="arrow" size={22} /></button>
        <p className="cast-pool-note">戦闘報酬は、この職業の専用カードから。</p>
      </section>
    </div>
    {showDeck && <Modal title={`${job.displayName}の初期デッキ`} subtitle="THE FIRST TEN TEACHINGS" wide onClose={closeDeck} className="cast-deck-modal">
      <p className="cast-deck-intro">{job.starterDeck.length}枚で冒険を始めます。表示を切り替えても、初期カードは強化されません。</p>
      {selected === 'oracle' && <p className="cast-rule-note">星は消費せず蓄積します。当ターンに得た星の数でカードが連携し、鍛造するほど保留できる聖剣が強くなります。</p>}
      {selected === 'necromancer' && <p className="cast-rule-note">岩霊は命令カードで攻撃し、通常攻撃のブロック後の残りを肩代わりします。全体攻撃は本体と岩霊に個別命中。敵ターン開始時、毒の処理後に破滅が敵HP以上なら撃破します。</p>}
      {selected === 'machinist' && <p className="cast-rule-note">オーブは最大{orbSlotCount()}個。雷はターン終了時{orbEffectValue('lightning', 'passive', 0)}ダメージ、解放時{orbEffectValue('lightning', 'evoke', 0)}ダメージ。霜は終了時{orbEffectValue('frost', 'passive', 0)}ブロック、解放時{orbEffectValue('frost', 'evoke', 0)}ブロック。集中力で効果量が増え、解放は右端から行います。</p>}
      <div className="cast-starter-list">{[...starterCounts].map(([cardId, count]) => <div className="cast-starter-entry" key={cardId}><span className="cast-starter-count">× {count}枚</span><ChoiceCard card={{ uid: `starter-${cardId}`, cardId, upgraded: false }} /></div>)}</div>
    </Modal>}
  </main>;
}
