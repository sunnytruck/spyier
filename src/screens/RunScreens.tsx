import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { RunAction, RunState } from '../types/run';
import type { CardInstance, GameSettings } from '../types/game';
import { CARD_DEFINITIONS } from '../data/cards';
import { RELIC_DEFINITIONS } from '../data/relics';
import { POTION_DEFINITIONS } from '../data/potions';
import { EVENT_DEFINITIONS } from '../data/events';
import { CLASS_DEFINITIONS } from '../data/classes';
import { canAscendAct, canChooseEvent, getShopCardPrice, getShopRelicPrice, getShopPotionPrice, getShopRemovePrice } from '../engine/run';
import { getActDefinition } from '../data/acts';
import { CardView } from '../components/CardView';
import { CardUpgradePreview } from '../components/CardUpgradePreview';
import { canUpgradeCard } from '../presentation/cardUpgrade';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { RelicIcon, RelicBadge } from '../components/RelicIcon';
import { RelicAcquisitionScreen } from './RelicAcquisitionScreen';
import { RockDeity } from '../components/CharacterArt';
import '../styles/run.css';
import { MapScreen } from './MapScreen';
import { BlessingScreen } from './BlessingScreen';

interface RunScreensProps {
  state: RunState;
  onAction: (action: RunAction) => void;
  onNewRun: () => void;
  onReplay: () => void;
  onTitle: () => void;
  settings?: GameSettings;
}


function Gold({ amount }: { amount: number }) {
  return (
    <span className="run-gold">
      <span aria-hidden="true">◎</span> {amount}
      <small>G</small>
    </span>
  );
}

function ScreenHeading({
  kicker,
  title,
  text,
  children,
}: {
  kicker: string;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <header className="run-screen-heading">
      <div>
        <p className="eyebrow">
          <span className="gold-line" />
          {kicker}
        </p>
        <h1>{title}</h1>
        {text && <p className="run-heading-description">{text}</p>}
      </div>
      {children}
    </header>
  );
}

function RunStatus({ state, onDeck }: { state: RunState; onDeck: () => void }) {
  return (
    <div className="run-status-strip">
      <div className="run-status-hero">
        <span className="run-status-seal">岩</span>
        <div>
          <small>{state.classId ? CLASS_DEFINITIONS[state.classId].displayName : 'じっと教 教祖'}</small>
          <b>岩尊けいと</b>
        </div>
      </div>
      <div className="run-hp-stat">
        <Icon name="heart" size={15} />
        <b>
          {state.hp}
          <small> / {state.maxHp}</small>
        </b>
        <span className="run-mini-hp">
          <i style={{ width: `${state.maxHp > 0 ? (state.hp / state.maxHp) * 100 : 0}%` }} />
        </span>
      </div>
      <Gold amount={state.gold} />
      <button className="run-deck-stat" onClick={onDeck} title="現在のデッキを見る">
        <Icon name="cards" size={17} />
        <span>
          デッキ <b>{state.deck.length}</b>
        </span>
      </button>
      <div className="run-status-relics" aria-label="所持レリック">
        {state.relicIds.map((id) => (
          <RelicBadge key={id} id={id} small />
        ))}
      </div>
      <span className="run-status-floor">
        第1層 <b>{Math.min(state.floor, state.map.floors)}</b>
        <small> / {state.map.floors}</small>
      </span>
    </div>
  );
}

function SceneArt({ kind }: { kind: 'rest' | 'shop' | 'event' | 'relic' }) {
  return (
    <div className={`run-scene-art run-scene-art--${kind}`} aria-hidden="true">
      <div className="run-scene-orbit" />
      <svg viewBox="0 0 380 250" fill="none">
        <ellipse cx="190" cy="223" rx="142" ry="13" fill="#090d08" opacity=".6" />
        <path d="M35 226h310M49 233h282" stroke="#b7985b" opacity=".25" />
        {kind === 'rest' ? (
          <>
            <path d="m105 210 58-24 92 24-14 15-79-13-43 10Z" fill="#6b6146" stroke="#9d8557" />
            <path d="m122 224 37-37 92 18-3 13-81-14-30 28Z" fill="#4c533f" stroke="#8e825a" />
            <path
              d="M188 77c21 56-48 54-21 99-3-28 27-30 28-58 48 38 59 72 21 89-46 19-85-11-68-44 10-20 9-46 40-86Z"
              fill="#bc873b"
              opacity=".75"
            />
            <path
              d="M191 140c14 21-18 29-9 47 4-8 12-9 15-19 17 24 12 40-7 42-26-4-32-27-15-44Z"
              fill="#efc77a"
            />
            <path
              d="M163 82v-8m53 20 3-8m-19-28v-7M139 134l-3-7m94 32 3-8"
              stroke="#d8ad61"
              strokeWidth="2"
            />
            <path
              d="m70 202 14-17 23 10-4 23H79ZM271 207l15-14 20 12-5 16h-31Z"
              fill="#4b5b42"
              stroke="#788263"
            />
          </>
        ) : kind === 'shop' ? (
          <>
            <path d="M81 105h220l-27-65H109Z" fill="#605b3e" stroke="#b59b62" />
            <path
              d="M109 40h165M109 40l-10 65m47-65-4 65m41-65 2 65m34-65 8 65m20-65 18 65"
              stroke="#b5995c"
              strokeWidth="3"
              opacity=".5"
            />
            <path d="M91 112v111m200-111v111M80 224h222" stroke="#8c8058" strokeWidth="7" />
            <path
              d="M81 105c0 24 35 25 43 0 0 24 39 25 45 0 0 24 39 25 45 0 0 24 39 25 44 0 0 24 43 25 43 0"
              fill="#827047"
              stroke="#b59b62"
            />
            <path d="m158 160 8-26 28-10 29 16 8 29-13 22h-49Z" fill="#768068" stroke="#a4a481" />
            <path d="m170 151 12 2m19 0 11-2" stroke="#e3bf75" strokeWidth="3" />
            <path d="M139 215v-26l28-14h53l25 15v25" fill="#4b6048" stroke="#8b9471" />
            <path d="M110 192h162v30H110Z" fill="#5e5a3f" stroke="#a08a57" />
            <path d="M121 196h140M121 215h140" stroke="#948052" />
            <path d="m123 181 3-19h17l4 19ZM239 182l3-15h15l4 15Z" fill="#ab9458" />
            <path d="M131 165v-7m119 13v-9" stroke="#d4b777" />
          </>
        ) : kind === 'relic' ? (
          <>
            <path d="m111 211 23-24h112l24 24v14H111Z" fill="#535b41" stroke="#a79962" />
            <path d="M142 187v-21h96v21M154 166v-23h72v23" fill="#6c7050" stroke="#b2a06a" />
            <path d="m189 53 34 46-34 44-34-44Z" fill="#766844" stroke="#dfc17d" strokeWidth="2" />
            <path d="m189 70 21 29-21 27-20-27Z" fill="#ceb172" />
            <path d="m189 70-1 55m-19-26h40" stroke="#f3d69a" opacity=".5" />
            <path
              d="M189 22v13m0 116v10M120 96h13m112 0h13M140 47l10 11m77 76 10 10M139 144l11-10m77-76 10-11"
              stroke="#c4a66b"
              opacity=".6"
            />
            <circle cx="189" cy="98" r="64" stroke="#b4975b" opacity=".25" />
            <circle cx="189" cy="98" r="78" stroke="#b4975b" strokeDasharray="2 12" opacity=".2" />
          </>
        ) : (
          <>
            <path
              d="m126 221-9-105 18-49 38-18 49 7 33 37 13 128Z"
              fill="#54634b"
              stroke="#9b9b73"
              strokeWidth="2"
            />
            <path d="m135 67 38-18 49 7-14 22-43 4-29 25Z" fill="#8b9170" />
            <path d="m208 78 14-22 33 37 13 128h-30l-9-102Z" fill="#40573e" />
            <path
              d="M158 115h43m-38 17h47m-48 20h24m-20 19h43m-41 21h29"
              stroke="#c3b77f"
              strokeWidth="3"
              strokeLinecap="round"
              opacity=".7"
            />
            <path d="m121 113 11 11-5 22m109 32-10 16 7 26" stroke="#2b472e" strokeWidth="3" />
            <path d="m98 219 8-22 22 1 5 23m108 0 5-18 25-4 10 22" fill="#667f4f" />
            <path d="m132 67 4-10 17-4 9 9-4 16-21 8-10-8Z" fill="#758c51" />
            <path d="m145 58 9 7-5 10-15 4" stroke="#9cab6e" strokeWidth="3" />
          </>
        )}
      </svg>
      <span className="run-scene-caption">
        {kind === 'rest'
          ? '石にも、ひと休み。'
          : kind === 'shop'
            ? '品揃え、かためです。'
            : kind === 'relic'
              ? '古い岩には、力が宿る。'
              : '塔は、じっとあなたを見ている。'}
      </span>
    </div>
  );
}


function RewardScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const reward = state.reward;
  return (
    <div className="run-centered-screen">
      <ScreenHeading
        kicker={reward?.rareOnly ? 'BOSS · RARE CARD REWARD' : 'BATTLE REWARD'}
        title={reward?.rareOnly ? 'レアな教えを、その手に。' : '新たな教えを、その手に。'}
        text="カードを1枚選び、デッキに加えましょう。受け取らずに進むこともできます。"
      />
      <div className="run-reward-summary">
        <span className="run-victory-word">
          <Icon name="sun" size={18} /> 戦闘勝利
        </span>
        <span>
          獲得済み <Gold amount={reward?.gold ?? 0} />
        </span>
        {reward?.potionId && (
          <span className="run-reward-potion">
            {POTION_DEFINITIONS[reward.potionId]?.name ?? 'ポーション'}を獲得
          </span>
        )}
      </div>
      <div className="run-reward-cards">
        {reward?.cardIds.map((cardId, index) => (
          <div key={`${cardId}-${index}`} className="run-card-choice">
            <CardView card={{ uid: `reward-${index}-${cardId}`, cardId, upgraded: false }} inspect />
            <span className="run-card-rarity">
              {CARD_DEFINITIONS[cardId]?.rarity === 'rare'
                ? '希少な教え'
                : CARD_DEFINITIONS[cardId]?.rarity === 'uncommon'
                  ? '特別な教え'
                  : '新たな教え'}
            </span>
            <button
              className="secondary-button"
              onClick={() => onAction({ type: 'takeCard', cardId })}
            >
              このカードを受け取る
              <Icon name="arrow" size={15} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="run-skip-button text-button"
        onClick={() => onAction({ type: 'takeCard', cardId: null })}
      >
        カードを受け取らずに進む <Icon name="arrow" size={15} />
      </button>
      <p className="run-small-note">小さなデッキも、立派な戦略です。</p>
    </div>
  );
}

function RelicScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const relicId = state.reward?.relicId;
  const relic = relicId ? RELIC_DEFINITIONS[relicId] : null;
  return (
    <div className="run-facility-screen">
      <ScreenHeading
        kicker="ANCIENT BLESSING"
        title="岩に刻まれた、古代の祝福。"
        text="レリックは所持しているだけで、これからの戦闘を助けてくれます。"
      />
      <div className="run-facility-grid">
        <SceneArt kind="relic" />
        <div className="run-facility-content">
          <p className="section-kicker">RELIC DISCOVERED</p>
          <div className="run-discovered-relic">
            <span className="run-large-glyph">{relicId && <RelicIcon id={relicId} size={76} />}</span>
            <div>
              <small>レリック</small>
              <h2>{relic?.name ?? '古代の祝福'}</h2>
            </div>
          </div>
          <p className="run-facility-description">
            {relic?.description ?? '古代の力を受け取り、先へ進みましょう。'}
          </p>
          <p className="run-flavor">「ほいっと〜。これは、いい岩。」</p>
          <button className="primary-button" onClick={() => onAction({ type: 'takeRelic' })}>
            祝福を受け取る <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EventScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const event = state.eventId ? EVENT_DEFINITIONS[state.eventId] : null;
  return (
    <div className="run-facility-screen">
      <ScreenHeading
        kicker="A STRANGE ENCOUNTER"
        title={event?.title ?? '塔の出来事'}
        text="この出会いが、どんな教えになるでしょう。"
      />
      <div className="run-facility-grid">
        <SceneArt kind="event" />
        <div className="run-facility-content">
          <p className="section-kicker">EVENT</p>
          <p className="run-event-story">{event?.description}</p>
          <div className="run-event-choices">
            {event?.choices.map((choice, index) => {
              const allowed = canChooseEvent(state, index);
              const needsUpgrade = choice.effects.some((effect) => effect.type === 'upgrade');
              const disabledReason = state.gold < (choice.goldCost ?? 0)
                ? '必要なゴールドが足りません'
                : state.hp <= (choice.hpCost ?? 0)
                  ? '必要なHPが足りません'
                  : needsUpgrade && !state.deck.some(canUpgradeCard)
                    ? '強化できる未強化カードがありません'
                    : 'この選択肢は現在利用できません';
              return (
                <button
                  key={index}
                  className="run-event-choice"
                  disabled={!allowed}
                  onClick={() => onAction({ type: 'eventChoice', index })}
                >
                  <span className="run-choice-number">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <b>{choice.label}</b>
                    <small>{state.classId ? (choice.classDescription ?? choice.description) : choice.description}</small>
                    {allowed && needsUpgrade && <em className="run-choice-preview-hint">選ぶとランダムな対象を強化し、結果を表示します</em>}
                    {!allowed && <em>{disabledReason}</em>}
                  </span>
                  <Icon name="arrow" size={17} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventResultScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const result = state.eventResult;
  const event = result ? EVENT_DEFINITIONS[result.eventId] : null;
  const cardGroups = result ? [
    { title: '磨き上げられた教え', cards: result.upgradedCards, kind: 'upgraded' },
    { title: '新しく得た教え', cards: result.addedCards, kind: 'added' },
    { title: '手放した教え', cards: result.removedCards, kind: 'removed' },
  ] : [];
  return (
    <div className="run-event-result">
      <ScreenHeading kicker="THE CHOICE IS MADE" title={event?.title ?? '出来事の結果'} text="選択の結果は保存されています。" />
      <section className="event-result-summary" aria-label="選択の結果">
        <span className="section-kicker">RESULT</span>
        <h2>{result?.choiceLabel ?? '次の石段へ'}</h2>
        {result?.description && <p>{result.description}</p>}
        <div className="event-result-deltas">
          {result && result.hpChange !== 0 && <span className={result.hpChange < 0 ? 'is-loss' : 'is-gain'}><Icon name="heart" size={18} /> HP {result.hpChange > 0 ? '+' : ''}{result.hpChange}</span>}
          {result && result.goldChange !== 0 && <span className={result.goldChange < 0 ? 'is-loss' : 'is-gain'}>◎ ゴールド {result.goldChange > 0 ? '+' : ''}{result.goldChange}</span>}
        </div>
        {!!result?.relicIds.length && <div className="event-result-relics">{result.relicIds.map((id) => <RelicBadge key={id} id={id} />)}</div>}
        {!!result?.potionIds.length && <div className="event-result-potions">{result.potionIds.map((id, index) => {
          const potion = POTION_DEFINITIONS[id];
          return potion ? <article key={`${id}-${index}`}><b>{potion.name}</b><p>{potion.description}</p></article> : null;
        })}</div>}
      </section>
      {cardGroups.filter((group) => group.cards.length > 0).map((group) => (
        <section className={`event-result-card-section event-result-${group.kind}`} key={group.kind}>
          <h2>{group.title}</h2>
          {group.kind === 'upgraded' && <p className="run-small-note">以下は強化が完了したカードです。コスト・効果はこの状態でデッキに反映されています。</p>}
          <div className="event-result-card-grid">{group.cards.map((card) => <CardView key={card.uid} card={card} inspect showUpgradePreview={false} />)}</div>
        </section>
      ))}
      {result?.combatEnemyIds?.length ? <p className="event-result-battle-note">この先で特別な戦闘が始まります。敵の行動予告を見て、備えましょう。</p> : null}
      <div className="event-result-actions">
        <button className="primary-button" onClick={() => onAction({ type: 'continueEvent' })}>{result?.combatEnemyIds?.length ? '試練の戦闘へ' : 'マップへ進む'} <Icon name="arrow" size={18} /></button>
      </div>
    </div>
  );
}

function ShopScreen({
  state,
  onAction,
  onRemove,
}: Pick<RunScreensProps, 'state' | 'onAction'> & { onRemove: () => void }) {
  const shop = state.shop;
  const relic = shop?.relicId ? RELIC_DEFINITIONS[shop.relicId] : null;
  const potion = shop?.potionId ? POTION_DEFINITIONS[shop.potionId] : null;
  const purchased = new Set(shop?.purchased ?? []);
  const isPurchased = (kind: string, id: string) =>
    purchased.has(id) || purchased.has(`${kind}:${id}`) || purchased.has(kind);
  return (
    <>
      <ScreenHeading
        kicker="THE STONE MERCHANT"
        title="岩商人の小さな露店"
        text="「お代も、意志も、かたくお願いします。」"
      >
        <button className="secondary-button" onClick={() => onAction({ type: 'leaveNode' })}>
          買い物を終える <Icon name="arrow" size={15} />
        </button>
      </ScreenHeading>
      <div className="run-shop">
        <div className="run-shop-cards">
          {shop?.cardIds.map((cardId) => {
            const bought = isPurchased('card', cardId);
            const price = getShopCardPrice(state, cardId);
            return (
              <div className={`run-card-choice${bought ? ' is-bought' : ''}`} key={cardId}>
                <CardView card={{ uid: `shop-${cardId}`, cardId, upgraded: false }} inspect />
                <button
                  className="secondary-button"
                  disabled={bought || state.gold < price}
                  onClick={() => onAction({ type: 'buyCard', cardId })}
                >
                  {bought ? (
                    '購入済み'
                  ) : (
                    <>
                      <span>購入する</span>
                      <Gold amount={price} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div className="run-shop-supplies">
          {relic && shop?.relicId && (
            <article className="run-shop-item">
              <span className="run-supply-glyph"><RelicIcon id={relic.id} size={52} /></span>
              <div>
                <small>レリック</small>
                <h3>{relic.name}</h3>
                <p>{relic.description}</p>
              </div>
              <button
                className="secondary-button"
                disabled={isPurchased('relic', shop.relicId) || state.gold < getShopRelicPrice(state)}
                onClick={() => onAction({ type: 'buyRelic' })}
              >
                {isPurchased('relic', shop.relicId) ? (
                  '購入済み'
                ) : (
                  <Gold amount={getShopRelicPrice(state)} />
                )}
              </button>
            </article>
          )}
          {potion && shop?.potionId && (
            <article className="run-shop-item">
              <span className="run-supply-glyph">{potion.glyph}</span>
              <div>
                <small>ポーション</small>
                <h3>{potion.name}</h3>
                <p>{potion.description}</p>
                {!state.potions.includes(null) && <em>ポーションの所持枠がいっぱいです</em>}
              </div>
              <button
                className="secondary-button"
                disabled={
                  isPurchased('potion', shop.potionId) ||
                  state.gold < getShopPotionPrice(state) ||
                  !state.potions.includes(null)
                }
                onClick={() => onAction({ type: 'buyPotion' })}
              >
                {isPurchased('potion', shop.potionId) ? (
                  '購入済み'
                ) : (
                  <Gold amount={getShopPotionPrice(state)} />
                )}
              </button>
            </article>
          )}
          <article className="run-shop-item">
            <span className="run-supply-glyph">
              <Icon name="discard" size={31} />
            </span>
            <div>
              <small>デッキ整理 · 1度限り</small>
              <h3>教えを、ひとつ手放す</h3>
              <p>デッキから選んだカード1枚を取り除きます。最低5枚は残します。</p>
            </div>
            <button
              className="secondary-button"
              disabled={
                !!shop?.removed || state.gold < getShopRemovePrice(state) || state.deck.length <= 5
              }
              onClick={onRemove}
            >
              {shop?.removed ? '利用済み' : <Gold amount={getShopRemovePrice(state)} />}
            </button>
          </article>
        </div>
      </div>
      <p className="run-small-note run-shop-note">
        購入したカードはすぐにデッキに加わります。所持金が足りない品は購入できません。
      </p>
    </>
  );
}

function RestScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const heal = Math.ceil(state.maxHp * 0.3);
  const canUpgrade = state.deck.some(canUpgradeCard);
  return (
    <div className="run-facility-screen">
      <ScreenHeading
        kicker="A MOMENT OF STILLNESS"
        title="焚き火のそばで、じっと。"
        text="回復するか、教えを磨くか。どちらかひとつを選べます。"
      />
      <div className="run-facility-grid">
        <SceneArt kind="rest" />
        <div className="run-facility-content">
          <p className="section-kicker">REST SITE</p>
          <p className="run-rest-quote">「8時か、ねんねやな」</p>
          <p className="run-facility-description">
            長い石段の先で、暖かな火を見つけた。
            <br />
            岩の身体にも、休息は必要らしい。
          </p>
          <div className="run-rest-choices">
            <button
              className="run-event-choice"
              onClick={() => onAction({ type: 'rest', choice: 'heal' })}
            >
              <Icon name="heart" size={23} />
              <span>
                <b>ひと休みする</b>
                <small>
                  最大HPの30%（{heal}）を回復。現在 {state.hp} / {state.maxHp}
                </small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
            <button
              className="run-event-choice"
              disabled={!canUpgrade}
              onClick={() => onAction({ type: 'rest', choice: 'upgrade' })}
            >
              <Icon name="flame" size={23} />
              <span>
                <b>教えを磨く</b>
                <small>
                  {canUpgrade
                    ? 'デッキのカード1枚を、1段階強化します。'
                    : 'すべてのカードが強化済みです。'}
                </small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          </div>
          <p className="run-small-note">休息は選ぶと回復します。強化は対象と効果を確認し、確定してから休憩所を離れます。</p>
        </div>
      </div>
    </div>
  );
}

function UpgradeScreen({ state, onAction }: Pick<RunScreensProps, 'state' | 'onAction'>) {
  const cards = state.deck.filter(canUpgradeCard);
  const [showUpgraded, setShowUpgraded] = useState(false);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const selectedCard = cards.find((card) => card.uid === selectedUid);
  const closePreview = useCallback(() => setSelectedUid(null), []);
  return (
    <>
      <ScreenHeading
        kicker="REFINE YOUR TEACHING"
        title="ひとつの教えを、さらに深く。"
        text="一覧の表示を切り替えて、磨く教えを選びましょう。確定するまでは変更されません。"
      >
        <button className="secondary-button" onClick={() => onAction({ type: 'leaveNode' })}>
          休憩所に戻る
        </button>
      </ScreenHeading>
      <div className="run-upgrade-list-toolbar">
        <label className="run-upgrade-list-toggle">
          <input type="checkbox" checked={showUpgraded} onChange={(event) => setShowUpgraded(event.target.checked)} />
          <span>強化後を表示</span>
        </label>
        <p>{showUpgraded ? '一覧は強化後のプレビューです。デッキはまだ変更されていません。' : '一覧は現在の状態です。チェックするとすべての強化後を比較できます。'}</p>
      </div>
      <div className="run-upgrade-grid">
        {cards.map((card) => (
          <div key={card.uid} className="run-card-choice">
            <CardView card={showUpgraded ? { ...card, upgraded: true } : card} inspect showUpgradePreview={false} />
            <button
              className="secondary-button"
              onClick={() => setSelectedUid(card.uid)}
              aria-label={`${CARD_DEFINITIONS[card.cardId]?.name}の強化内容を確認`}
            >
              <Icon name="flame" size={14} />
              強化内容を確認
            </button>
          </div>
        ))}
      </div>
      {cards.length === 0 && (
        <p className="run-empty-message">すべての教えが磨き上げられています。</p>
      )}
      {selectedCard && (
        <Modal title={`${CARD_DEFINITIONS[selectedCard.cardId].name}を磨く`} subtitle="REFINE YOUR TEACHING" onClose={closePreview} className="card-upgrade-modal">
          <CardUpgradePreview key={selectedCard.uid} card={selectedCard} />
          <div className="card-upgrade-actions">
            <button className="secondary-button" onClick={closePreview}>カード選択に戻る</button>
            <button className="primary-button" onClick={() => onAction({ type: 'upgradeCard', cardUid: selectedCard.uid })}>強化を確定する <Icon name="flame" size={17} /></button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ResultScreen({
  state,
  onAction,
  onNewRun,
  onReplay,
  onTitle,
}: Pick<RunScreensProps, 'state' | 'onAction' | 'onNewRun' | 'onReplay' | 'onTitle'>) {
  const won = state.screen === 'victory';
  const act = state.act ?? 1;
  const ascending = canAscendAct(state);
  return (
    <div className={`run-result-screen${won ? ' is-victory' : ''}`}>
      <div className="run-result-art">
        <div className="run-result-halo" />
        <RockDeity deified={won} classId={state.classId} />
      </div>
      <div className="run-result-content">
        <p className="eyebrow">
          <span className="gold-line" />
          {won ? `ACT ${act} · CONQUERED` : 'THE JOURNEY ENDS'}
        </p>
        <h1>{won ? ascending ? 'ひとつ上の、祝福へ。' : '岩の頂に、辿り着いた。' : '今日は、ここまで。'}</h1>
        <p className="run-result-subtitle">{won ? `第${act}階層 クリア${state.act && !ascending ? ' · 全Act踏破' : ''}` : 'GAME OVER'}</p>
        <p className="run-result-description">
          {won
            ? `${state.act ? getActDefinition(act).name : '不動の回廊'}の主は倒れた。${ascending ? 'デッキと所持品を携え、次の出会いへ進もう。' : '塔に響くのは、いつものひと言。'}`
            : '岩尊けいとは静かに腰を下ろした。教えは次の旅に引き継がれる。'}
        </p>
        <p className="run-result-quote">
          {won ? '「ほいっと〜。朝活、完了やな。」' : '「8時か、ねんねやな」'}
        </p>
        <div className="run-result-stats">
          <div>
            <b>
              {state.floor}
              <small> / 12</small>
            </b>
            <span>到達フロア</span>
          </div>
          <div>
            <b>{state.stats.battlesWon}</b>
            <span>戦闘勝利</span>
          </div>
          <div>
            <b>{state.stats.elitesDefeated}</b>
            <span>エリート撃破</span>
          </div>
          <div>
            <b>{state.deck.length}</b>
            <span>デッキ枚数</span>
          </div>
        </div>
        <div className="run-result-relics">
          <span>旅で得た祝福</span>
          {state.relicIds.length ? (
            state.relicIds.map((id) => <RelicBadge key={id} id={id} small />)
          ) : (
            <small>レリックなし</small>
          )}
        </div>
        {ascending && <button className="primary-button" onClick={() => onAction({ type: 'ascendAct' })}>Act {act + 1}へ進む · 次の祝福 <Icon name="arrow" size={18} /></button>}
        <button className={ascending ? 'secondary-button' : 'primary-button'} onClick={onNewRun}>
          新たな冒険を始める <Icon name="arrow" size={18} />
        </button>
        <div className="run-result-secondary">
          <button className="text-button" onClick={onReplay}>
            <Icon name="repeat" size={14} /> 同じシードで再挑戦
          </button>
          <button className="text-button" onClick={onTitle}>
            タイトルへ戻る <Icon name="chevron" size={13} />
          </button>
        </div>
        {won && state.act === undefined && (
          <button disabled className="run-future-act">
            第二層 · 今後のアップデートで開放
          </button>
        )}
        <p className="run-result-seed">
          SEED <span>{state.seed}</span>
        </p>
      </div>
    </div>
  );
}

export function RunScreens({ state, onAction, onNewRun, onReplay, onTitle, settings }: RunScreensProps) {
  const [deckOpen, setDeckOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    setRemoving(false);
    setDeckOpen(false);
  }, [state.screen]);
  function remove(card: CardInstance) {
    onAction({ type: 'removeCard', cardUid: card.uid });
    setRemoving(false);
  }
  let screen: ReactNode;
  switch (state.screen) {
    case 'blessing':
      screen = <BlessingScreen state={state} onAction={onAction} settings={settings} />;
      break;
    case 'relicAcquisition':
      screen = <RelicAcquisitionScreen state={state} onAction={onAction} settings={settings} />;
      break;
    case 'map':
      screen = <MapScreen state={state} onAction={onAction} />;
      break;
    case 'reward':
      screen = <RewardScreen state={state} onAction={onAction} />;
      break;
    case 'relic':
      screen = <RelicScreen state={state} onAction={onAction} />;
      break;
    case 'event':
      screen = <EventScreen state={state} onAction={onAction} />;
      break;
    case 'eventResult':
      screen = <EventResultScreen state={state} onAction={onAction} />;
      break;
    case 'shop':
      screen = <ShopScreen state={state} onAction={onAction} onRemove={() => setRemoving(true)} />;
      break;
    case 'rest':
      screen = <RestScreen state={state} onAction={onAction} />;
      break;
    case 'upgrade':
      screen = <UpgradeScreen state={state} onAction={onAction} />;
      break;
    case 'victory':
    case 'defeat':
      screen = (
        <ResultScreen state={state} onAction={onAction} onNewRun={onNewRun} onReplay={onReplay} onTitle={onTitle} />
      );
      break;
    case 'combat':
      return null;
  }
  return (
    <main className={`run-screen run-screen--${state.screen}`}>
      <RunStatus state={state} onDeck={() => setDeckOpen(true)} />
      {screen}
      {(deckOpen || removing) && (
        <Modal
          title={removing ? '手放す教えを選ぶ' : `現在のデッキ · ${state.deck.length}枚`}
          subtitle={removing ? `REMOVE A CARD · ${getShopRemovePrice(state)} GOLD` : 'YOUR TEACHINGS'}
          onClose={() => {
            setDeckOpen(false);
            setRemoving(false);
          }}
          wide
        >
          <p className="modal-intro">
            {removing
              ? '選んだカード1枚をデッキから取り除きます。この操作には60ゴールドを消費します。'
              : 'これまでの旅で身につけた教え。強化済みのカードには「＋」が付きます。'}
          </p>
          <div className="run-deck-grid">
            {state.deck.map((card) => (
              <div className="run-card-choice" key={card.uid}>
                <CardView card={card} inspect />
                {removing && (
                  <button className="secondary-button danger-text" disabled={state.deck.length <= 5 || state.gold < getShopRemovePrice(state) || !!state.shop?.removed} onClick={() => remove(card)}>
                    このカードを取り除く
                  </button>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </main>
  );
}
