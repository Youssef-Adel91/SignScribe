import type { IconName } from '../ui/Icon';
import type { Place } from '../nlp/words';
import contexts from '../data/contexts.json';

export interface CardDef {
  word: string; // shown label, also the word added to the message
  icon: IconName;
}

/** Card packs per place, from src/data/contexts.json (the same file lists the detector's classes). */
export const CARD_PACKS = contexts.places as unknown as Record<Place, CardDef[]>;

/** Detector classes: index = class id. Fixed by the file, so a trained model and the app agree. */
export const CARD_CLASSES: readonly string[] = contexts.classes;

export const cardFor = (place: Place, word: string): CardDef | undefined =>
  CARD_PACKS[place].find((c) => c.word.toLowerCase() === word.toLowerCase());
