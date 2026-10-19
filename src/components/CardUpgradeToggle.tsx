export function CardUpgradeToggle({
  upgraded,
  onToggle,
}: {
  upgraded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="card-upgrade-toggle"
      aria-pressed={upgraded}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {upgraded ? '強化前を表示' : '強化後を表示'}
      <span aria-hidden="true">{upgraded ? '↶' : '＋'}</span>
    </button>
  );
}
