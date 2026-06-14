import type { ReactNode } from 'react';
import { Mic, Wallet, Camera, Share2, Zap } from 'lucide-react';
import type { ChipTone } from '../../ui';

export type DoorId = 'speak' | 'constrain' | 'show' | 'share' | 'predict';

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
 * The five front doors — "five ways in, one brain, one confident cart out".
 * Includes the Zero Door (predictive restock) as the 5th entry point.
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
  {
    id: 'predict',
    label: 'Zero Door',
    tagline: 'We already know what you need',
    description:
      'No input needed. NowCart watches your purchase patterns, predicts when you\'ll run out, and pre-builds a confident restock cart before you even ask.',
    endpoint: 'predict',
    icon: <Zap size={22} />,
    tone: 'secondary',
    chipTone: 'secondary',
  },
];
