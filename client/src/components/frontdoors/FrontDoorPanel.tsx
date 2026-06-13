import { Panel } from '../../ui';
import type { FrontDoor } from './doors';
import type { AppContext } from '../../App';
import SpeakPanel from './panels/SpeakPanel';
import ConstrainPanel from './panels/ConstrainPanel';
import ShowPanel from './panels/ShowPanel';
import SharePanel from './panels/SharePanel';

interface Props {
  door: FrontDoor | null;
  onClose: () => void;
  ctx: AppContext;
}

/**
 * FrontDoorPanel — opens a selected front door as an accessible client-side
 * panel (no page reload). Each door renders its own live input → loading →
 * result flow; all four route into the same engine and return one cart.
 */
export default function FrontDoorPanel({ door, onClose, ctx }: Props) {
  if (!door) return null;

  const tone = door.tone === 'info' ? 'primary' : door.tone;

  return (
    <Panel
      open={!!door}
      onClose={onClose}
      title={door.label}
      subtitle={door.tagline}
      icon={door.icon}
      tone={tone}
    >
      {door.id === 'speak' && <SpeakPanel ctx={ctx} onClose={onClose} />}
      {door.id === 'constrain' && <ConstrainPanel ctx={ctx} onClose={onClose} />}
      {door.id === 'show' && <ShowPanel ctx={ctx} onClose={onClose} />}
      {door.id === 'share' && <SharePanel ctx={ctx} onClose={onClose} />}
    </Panel>
  );
}
