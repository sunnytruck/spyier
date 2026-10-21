import { useState, type ReactNode } from 'react';
import type { CardInstance } from '../types/game';
import { getCardUpgradePreview } from '../presentation/cardUpgrade';
import { ChoiceCard } from './ChoiceCard';
import { CardUpgradeToggle } from './CardUpgradeToggle';
import '../styles/card-upgrade.css';

/** Shared by rest sites and event confirmation; all changes remain local to the view. */
export function CardUpgradePreview({ card, children }: {
  card: CardInstance;
  children?: ReactNode;
}) {
  const [showAfter, setShowAfter] = useState(false);
  const preview = getCardUpgradePreview(card);
  if (!preview) return null;
  const current = showAfter ? preview.after : preview.before;
  const changeDescription = [
    preview.changes.cost ? `コスト ${preview.before.cost} → ${preview.after.cost}` : null,
    preview.changes.description ? '効果の変更部分を強調表示' : null,
    preview.changes.keywords ? `特性 ${preview.before.keywords.join('・') || 'なし'} → ${preview.after.keywords.join('・') || 'なし'}` : null,
  ].filter(Boolean);
  return (
    <section className={`card-upgrade-comparison choice-upgrade-comparison${showAfter ? ' is-after' : ''}`} aria-label="カードの強化プレビュー">
      <div className="card-upgrade-toolbar">
        <span className="card-upgrade-stage" aria-live="polite">{showAfter ? '強化後のプレビュー' : '強化前のカード'}</span>
        <CardUpgradeToggle upgraded={showAfter} onToggle={() => setShowAfter((value) => !value)} />
      </div>
      <div className="card-upgrade-preview-face" aria-live="polite" aria-atomic="true">
        <ChoiceCard card={current.card} showUpgradePreview={false} highlightUpgradeChanges />
      </div>
      <p className="card-upgrade-change-note">{changeDescription.join(' / ') || 'カード名が強化済みに変わります。'}</p>
      <p className="card-upgrade-safety-note">プレビューではカードは変更されません。確定すると1段階強化します。</p>
      {children}
    </section>
  );
}
