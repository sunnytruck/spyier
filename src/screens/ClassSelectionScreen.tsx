import { CLASS_DEFINITIONS, CLASS_IDS } from '../data/classes';
import { RELIC_DEFINITIONS } from '../data/relics';
import type { ClassId } from '../types/game';
import { CardView } from '../components/CardView';
import { Icon } from '../components/Icon';

export function ClassSelectionScreen({ selected, onSelect, onStart, onBack }: {
  selected: ClassId;
  onSelect: (id: ClassId) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const job = CLASS_DEFINITIONS[selected];
  const relic = RELIC_DEFINITIONS[job.starterRelicId];
  const starterCounts = new Map<string, number>();
  for (const id of job.starterDeck) starterCounts.set(id, (starterCounts.get(id) ?? 0) + 1);
  return (
    <main className="class-selection-screen">
      <div className="class-selection-heading">
        <div>
          <p className="eyebrow"><span className="gold-line" /> CHOOSE YOUR TEACHING</p>
          <h1>五つの道、ひとつの塔。</h1>
          <p>岩尊けいとの戦い方を選びましょう。戦闘報酬には、この職業のカードが現れます。</p>
        </div>
        <button className="text-button" onClick={onBack}>タイトルへ戻る</button>
      </div>
      <div className="class-options" role="group" aria-label="職業を選択">
        {CLASS_IDS.map((id) => {
          const option = CLASS_DEFINITIONS[id];
          return (
            <button key={id} className={`class-option ${selected === id ? 'is-selected' : ''}`}
              onClick={() => onSelect(id)} aria-pressed={selected === id}>
              <span className="class-glyph" aria-hidden="true">{option.glyph}</span>
              <b>{option.displayName}</b>
              <small>{option.resourceSummary}</small>
              <span className="class-option-hp">HP {option.maxHp}</span>
            </button>
          );
        })}
      </div>
      <section className="class-detail" aria-label={`${job.displayName}の詳細`}>
        <div className="class-detail-copy">
          <p className="section-kicker">YOUR PATH</p>
          <h2>{job.displayName}</h2>
          <p>{job.description}</p>
          {selected === 'oracle' && <p className="class-rule-note">今回のルール: ✦は獲得数でカードを連携させます。TXTに記載のない星コストは設定していません。鍛造は聖剣を強化します。</p>}
          {selected === 'necromancer' && <p className="class-rule-note">今回のルール: 岩霊はブロックで防ぎきれない攻撃をHPで引き受けます。岩霊のHPが0の間、召喚攻撃は不発です。破滅が敵のHP以上になると、敵ターン開始時に撃破します。</p>}
          {selected === 'machinist' && <p className="class-rule-note">今回のルール: オーブは最大3個。雷はターン終了時3ダメージ、解放時8ダメージ。霜は終了時2ブロック、解放時5ブロック。集中力は各効果量を増やします。解放は右端から行います。</p>}
          <dl>
            <div><dt>初期HP</dt><dd>{job.maxHp}</dd></div>
            <div><dt>初期デッキ</dt><dd>{job.starterDeck.length}枚</dd></div>
            <div><dt>固有の力</dt><dd>{job.resourceSummary}</dd></div>
          </dl>
          {relic && <div className="class-starting-relic"><span>{relic.glyph}</span><div><b>初期レリック · {relic.name}</b><p>{relic.description}</p></div></div>}
          <button className="primary-button" onClick={onStart}>この職業で探索を始める <Icon name="arrow" size={18} /></button>
          <p className="class-pool-note">実装・検証済みのカードのみ出現します。無色カードは商人や出来事で入手できます。</p>
        </div>
        <div className="class-starter-cards">
          {[...starterCounts].map(([cardId, count]) => <div className="class-starter-card" key={cardId}>
            <span className="class-starter-count">初期デッキ × {count}</span>
            <CardView card={{ uid: `starter-${cardId}`, cardId, upgraded: false }} inspect />
          </div>)}
        </div>
      </section>
    </main>
  );
}
