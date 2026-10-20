interface PreviewAnchor { left: number; right: number; top: number; bottom: number }

/** Keep the enlarged hand card inside the viewport, independent of page scrolling. */
export function getHandPreviewBounds(anchor: PreviewAnchor, viewport: { width: number; height: number }) {
  const margin = 10;
  const width = Math.min(292, Math.max(1, viewport.width - margin * 2));
  const maxHeight = Math.max(1, viewport.height - margin * 2);
  const height = Math.min(600, maxHeight);
  const beside = anchor.left + (anchor.right - anchor.left) / 2 < viewport.width / 2
    ? anchor.right + 12 : anchor.left - width - 12;
  return {
    left: Math.max(margin, Math.min(viewport.width - width - margin, beside)),
    top: Math.max(margin, Math.min(viewport.height - height - margin, anchor.bottom - height)),
    width,
    maxHeight: height,
  };
}
