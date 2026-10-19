import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../Modal';

/** A real dialog keeps resource explanations reachable by touch and keyboard. */
export function ResourceDetails({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = <Modal title={title} subtitle="職業固有の力" onClose={onClose} className="class-resource-modal">
    <div className="class-resource-detail-copy">{children}</div>
  </Modal>;
  // Actors are isolated animation layers. Mount beside the battlefield so enemy
  // targets cannot sit above a modal that was opened by a player-side resource.
  const target = typeof document === 'undefined' ? null : document.querySelector('.app');
  return target ? createPortal(dialog, target) : dialog;
}
