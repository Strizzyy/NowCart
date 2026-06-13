import type { ReactNode } from 'react';
import { Mic, Wallet, Camera, Share2 } from 'lucide-react';
import type { ChipTone } from '../../ui';

export type DoorId = 'speak' | 'constrain' | 'show' | 'share';

export interface FrontDoor {
  id: DoorId;
  /** short verb label, e.g. "Speak it" */
  label: string;
  /** one-line promise shown on the hub card */
  tagline: string;
  /** longer explanation shown in the open panel */
  description: string;
  /** backend door this maps to (wired fully in later sub-tasks) */
  endpoint: string;
  icon: ReactNode;
  tone: 'primary' | 'secondary' | 'accent' | 'info';
  chipTone: ChipTone;
}

/**
 * The four front doors — "four ways in, one brain, one confident cart out".
 * Each card on the Front Door Hub opens its panel client-side (no reload).
 */
export const FRONT_DOORS: FrontDoor[] = [
  {
    id: 'speak',
    label: 'Speak it',
    tagline: 'Say a meal or a moment out loud',
    description:
      'Talk to NowCart the way you would talk to a person. "Biryani for four", "weekly restock", "something healthy for breakfast" — the engine listens, understands, and fills the cart.',
    endpoint: 'voice/intent',
    icon: <Mic size={22} />,
    tone: 'primary',
    chipTone: 'primary',
  },
  {
    id: 'constrain',
    label: 'Constrain it',
    tagline: 'Give a budget and a headcount',
    description:
      'Set a budget and how many people you are feeding. The engine assembles the most complete cart that fits — and tells you exactly what is left over.',
    endpoint: 'constraint',
    icon: <Wallet size={22} />,
    tone: 'secondary',
    chipTone: 'secondary',
  },
  {
    id: 'show',
    label: 'Show it',
    tagline: 'Snap a dish you want to make',
    description:
      'Show a photo of a dish. The engine recognizes it, works out the likely ingredients, and maps them to products you can actually buy.',
    endpoint: 'vision/photo',
    icon: <Camera size={22} />,
    tone: 'accent',
    chipTone: 'accent',
  },
  {
    id: 'share',
    label: 'Share it',
    tagline: 'Paste a recipe link or text',
    description:
      'Drop in a recipe link or paste the text. The engine extracts the ingredients and turns them into one ready-to-checkout cart.',
    endpoint: 'share',
    icon: <Share2 size={22} />,
    tone: 'info',
    chipTone: 'info',
  },
];
