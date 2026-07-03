import type { ReactNode } from 'react';
import { Mic, Wallet, Camera, Share2, Zap } from 'lucide-react';
import type { ChipTone } from '../../ui';

export type DoorId = 'speak' | 'constrain' | 'show' | 'share' | 'predict';

export interface FrontDoor {
  id: DoorId;
  label: string;
  tagline: string;
  description: string;
  endpoint: string;
  icon: ReactNode;
  tone: 'primary' | 'secondary' | 'accent' | 'info';
  chipTone: ChipTone;
  /** True = hero feature, gets highlighted treatment */
  featured?: boolean;
}

export const FRONT_DOORS: FrontDoor[] = [
  // ── Featured three (Show, Share, Subscribe) come first ──
  {
    id: 'show',
    label: 'Show',
    tagline: 'Snap a dish you want to make',
    description:
      'Show a photo of a dish. The engine recognizes it, works out the likely ingredients, and maps them to products you can actually buy.',
    endpoint: 'vision/photo',
    icon: <Camera size={22} />,
    tone: 'accent',
    chipTone: 'accent',
    featured: true,
  },
  {
    id: 'share',
    label: 'Share',
    tagline: 'Paste a recipe link or text',
    description:
      'Drop in a recipe link or paste the text. The engine extracts the ingredients and turns them into one ready-to-checkout cart.',
    endpoint: 'share',
    icon: <Share2 size={22} />,
    tone: 'info',
    chipTone: 'info',
    featured: true,
  },
  {
    id: 'predict',
    label: 'Subscribe',
    tagline: 'Restock predictions + recurring schedules',
    description:
      "Two modes in one: let NowCart watch your purchase patterns and predict when you'll run out — or set recurring daily, weekly, or monthly subscriptions for products you always need. Pre-builds a confident cart before you even ask.",
    endpoint: 'subscribe',
    icon: <Zap size={22} />,
    tone: 'secondary',
    chipTone: 'secondary',
    featured: true,
  },
  // ── Secondary two (Speak, Budget) ──
  {
    id: 'speak',
    label: 'Speak',
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
    label: 'Budget',
    tagline: 'Give a budget and a headcount',
    description:
      'Set a budget and how many people you are feeding. The engine assembles the most complete cart that fits — and tells you exactly what is left over.',
    endpoint: 'constraint',
    icon: <Wallet size={22} />,
    tone: 'secondary',
    chipTone: 'secondary',
  },
];
