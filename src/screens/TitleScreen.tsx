import type { RunState } from '../types/run';
import type { CombatState } from '../types/game';
import { Icon } from '../components/Icon';
import { RockDeity } from '../components/CharacterArt';
import { WorldScene } from '../components/world/WorldScene';

interface TitleProps {
  run: RunState | null;
  practice: CombatState | null;
  seed: string;
  onSeed: (value: string) => void;
  onStart: () => void;
  onResume: () => void;
  onPractice: () => void;
  onResumePractice: () => void;
  onHelp: () => void;
}

/** A game entrance, independent of the saved run and its reducer. */
export function TitleScreen({ run, practice, seed, onSeed, onStart, onResume, onPractice, onResumePractice, onHelp }: TitleProps) {
  return <main className="title-screen sanctum-title" aria-label="IWASON SPIRE タイトル">
    <WorldScene variant="title" act={1} />
    <div className="title-temple-shadow" aria-hidden="true" />
    <div className="title-art sanctum-title-figure">
      <div className="sanctum-figure-light" aria-hidden="true" />
      <RockDeity deified />
      <div className="sanctum-figure-ground" aria-hidden="true" />
    </div>
    <div className="title-copy sanctum-title-copy">
      <div className="sanctum-logo">
        <svg className="sanctum-logo-mark" viewBox="0 0 120 140" aria-hidden="true"><path d="m60 4 48 28-7 65-41 38L19 97l-7-65Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m60 23 31 19-7 44-24 26-24-26-7-44Z" fill="currentColor" opacity=".1"/><path d="m32 84 14-43 14 37 15-48 13 54M25 94h69M60 12v16m0 80v16" fill="none" stroke="currentColor" strokeWidth="3"/><path d="m54 95 6-12 6 12-6 8Z" fill="currentColor"/></svg>
        <h1><span>IWASON</span><strong>SPIRE</strong></h1>
        <p className="title-japanese">じっと教の塔</p>
      </div>
      <nav className="title-actions sanctum-title-menu" aria-label="冒険を始める">
        {run && <button className="title-resume sanctum-menu-action" onClick={onResume}><span className="sanctum-menu-rune" aria-hidden="true">⌾</span><span>探索を再開<small>{run.act ? `Act ${run.act} · ` : ''}{run.floor}F / 12F</small></span><Icon name="arrow" size={22} /></button>}
        <button className="primary-button title-start sanctum-menu-action" onClick={onStart}><span className="sanctum-menu-rune" aria-hidden="true">◇</span><span>第1階層へ進む<small>新たな教えを、岩に刻む。</small></span><Icon name="arrow" size={23} /></button>
        <div className="sanctum-menu-minor">
          <button className="practice-start text-button" onClick={onPractice}>単体戦闘で練習<Icon name="arrow" size={15} /></button>
          {practice && <button className="text-button practice-resume" onClick={onResumePractice}>前回の練習を再開 · {practice.turn}ターン目</button>}
          <button className="text-button" onClick={onHelp}>最初の教え<Icon name="book" size={15} /></button>
        </div>
        <details className="sanctum-seed-drawer"><summary>運命の刻印 <span>シードを指定</span></summary><label className="seed-field"><span>シード</span><input value={seed} onChange={(event) => onSeed(event.target.value)} maxLength={64} placeholder="空欄なら、運命にまかせる" aria-label="新しい探索のシード" /></label></details>
      </nav>
    </div>
    <p className="sanctum-title-whisper">動かざること、岩のごとし。</p>
    <div className="character-signature sanctum-title-signature"><span>じっと教 教祖</span><b>岩尊けいと</b><small>「ほいっと〜」</small></div>
    <footer className="title-footer sanctum-title-footer"><span>IWASON SPIRE <i /> じっと教の塔</span><span>五つの道。ひとつの岩。</span></footer>
  </main>;
}
