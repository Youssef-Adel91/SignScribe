import type { IconName } from '../ui/Icon';
import type { Place } from '../nlp/words';

export interface CardDef {
  word: string; // shown label, also the word added to the message
  icon: IconName;
}

/**
 * PLACEHOLDER packs (Phase 5 moves them to data/contexts.json next to the detector classes).
 * Clinic matches screen 10 of the design.
 */
export const CARD_PACKS: Record<Place, CardDef[]> = {
  Clinic: [
    { word: 'Doctor', icon: 'cross' },
    { word: 'Pain', icon: 'bolt' },
    { word: 'Medicine', icon: 'clip' },
    { word: 'Water', icon: 'drop' },
    { word: 'Help', icon: 'help' },
    { word: 'Thank you', icon: 'heart' },
  ],
  Shop: [
    { word: 'Price', icon: 'bag' },
    { word: 'Size', icon: 'move' },
    { word: 'Pay', icon: 'doc' },
    { word: 'Bag', icon: 'bag' },
    { word: 'Help', icon: 'help' },
    { word: 'Thank you', icon: 'heart' },
  ],
  Work: [
    { word: 'Meeting', icon: 'briefcase' },
    { word: 'Email', icon: 'doc' },
    { word: 'Break', icon: 'drop' },
    { word: 'Question', icon: 'help' },
    { word: 'Help', icon: 'help' },
    { word: 'Thank you', icon: 'heart' },
  ],
  Home: [
    { word: 'Water', icon: 'drop' },
    { word: 'Food', icon: 'bag' },
    { word: 'Medicine', icon: 'clip' },
    { word: 'Family', icon: 'home' },
    { word: 'Help', icon: 'help' },
    { word: 'Thank you', icon: 'heart' },
  ],
};

export const cardFor = (place: Place, word: string): CardDef | undefined =>
  CARD_PACKS[place].find((c) => c.word.toLowerCase() === word.toLowerCase());
