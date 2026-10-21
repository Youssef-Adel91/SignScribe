import type { CardCandidate, Ev } from '../state/machine';
import type { Place } from '../nlp/words';
import { CARD_CLASSES, CARD_PACKS } from '../screens/cardPack';
import type { Track } from './sort';

/** Heuristics chosen before any real card data exists: tune them from a real camera and a measured detector. */
export const CARD = {
  /** a track needs this mean score and this share of the class votes */
  minScore: 0.5,
  minShare: 0.6,
  /** the same card is shown as a candidate after being seen this long */
  stableMs: 300,
  /** and added after being held (moving less than `maxSpeed`) this long */
  holdMs: 1000,
  /** picture heights per second: more than this and the hold restarts (the card is being moved around) */
  maxSpeed: 0.35,
  /** no card seen for this long: the candidate is dropped */
  lostMs: 500,
  /** after a card is added it must be out of view this long before the same card can be added again */
  clearMs: 600,
} as const;

export interface CardUI {
  /** box of the card being held, 0..1 of the un-mirrored picture */
  box: { x: number; y: number; w: number; h: number } | null;
  word: string | null;
  confidence: number;
  trackId: number | null;
  /** 0..1 hold progress */
  progress: number;
  /** a detected card that is not in this place's pack */
  foreign: string | null;
}

export const IDLE_CARD_UI: CardUI = {
  box: null,
  word: null,
  confidence: 0,
  trackId: null,
  progress: 0,
  foreign: null,
};

/**
 * Turns tracked cards into CARD_CANDIDATE / CARD_ADDED / CARD_LOST on the picture-card screen (10).
 * One card at a time: the largest confirmed one in this place's pack. A card is added by HOLDING it
 * still: passing a card through the picture adds nothing. Pure, tested with made-up tracks.
 */
export class CardController {
  private trackId: number | null = null;
  private since = 0;
  private holdStart = 0;
  private shown = false;
  private lastSeen = -Infinity;
  private added: { trackId: number; word: string } | null = null;
  private clearSince: number | null = null;
  private lastScreen = -1;

  private reset(): void {
    this.trackId = null;
    this.shown = false;
    this.added = null;
    this.clearSince = null;
  }

  step(
    tracks: Track[],
    t: number,
    inp: { screen: number; place: Place },
  ): { events: Ev[]; ui: CardUI } {
    const events: Ev[] = [];
    if (inp.screen !== this.lastScreen) {
      this.lastScreen = inp.screen;
      this.reset();
    }
    if (inp.screen !== 10) return { events, ui: IDLE_CARD_UI };

    const pack = new Set(CARD_PACKS[inp.place].map((c) => c.word));
    const named = tracks.map((tr) => ({
      tr,
      word: CARD_CLASSES[tr.classId] as string | undefined,
    }));
    const solid = named.filter(
      (n) => n.word && n.tr.score >= CARD.minScore && n.tr.share >= CARD.minShare,
    );
    const mine = solid.filter((n) => pack.has(n.word!));
    const foreign = solid.find((n) => !pack.has(n.word!))?.word ?? null;
    const best = mine.sort((a, b) => b.tr.box.w * b.tr.box.h - a.tr.box.w * a.tr.box.h)[0];

    // a card was just added: wait until it has gone (or another card shows) before it can count again
    if (this.added) {
      const still = mine.some((n) => n.word === this.added!.word);
      if (still) this.clearSince = null;
      else if (this.clearSince === null) this.clearSince = t;
      if (!still && t - this.clearSince! >= CARD.clearMs) this.added = null;
    }

    if (!best) {
      if (this.shown && t - this.lastSeen >= CARD.lostMs) {
        events.push({ type: 'CARD_LOST' });
        this.shown = false;
        this.trackId = null;
      }
      if (!this.shown) this.trackId = null;
      return { events, ui: { ...IDLE_CARD_UI, foreign } };
    }
    this.lastSeen = t;
    const { tr, word } = best;
    const blocked = this.added !== null && this.added.word === word;

    if (tr.id !== this.trackId) {
      if (this.shown) events.push({ type: 'CARD_LOST' });
      this.trackId = tr.id;
      this.since = t;
      this.holdStart = t;
      this.shown = false;
    }
    const ui = (progress: number): CardUI => ({
      box: tr.box,
      word: word!,
      confidence: tr.score,
      trackId: tr.id,
      progress,
      foreign,
    });
    if (blocked) return { events, ui: ui(0) };

    if (tr.speed > CARD.maxSpeed) this.holdStart = t; // being moved: the hold starts again
    if (t - this.since >= CARD.stableMs) {
      const cand: CardCandidate = { word: word!, confidence: tr.score, trackId: tr.id };
      events.push({ type: 'CARD_CANDIDATE', candidate: cand }); // refreshed every update: confidence follows the track
      this.shown = true;
    }
    const progress = this.shown ? Math.min(1, (t - this.holdStart) / CARD.holdMs) : 0;
    if (this.shown && progress >= 1) {
      events.push({ type: 'CARD_ADDED', word: word! });
      this.added = { trackId: tr.id, word: word! };
      this.clearSince = null;
      this.shown = false;
      this.trackId = null;
      return { events, ui: ui(1) };
    }
    return { events, ui: ui(progress) };
  }
}
