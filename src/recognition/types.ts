import type { HandObs } from '../vision/types';

export interface LetterGuess {
  letter: string;
  /** 0..1 */
  confidence: number;
  alternatives: { letter: string; confidence: number }[];
}

/**
 * A static-letter recognizer. The app only knows this interface, so a k-NN, a neural net or a
 * Wizard-of-Oz operator can be swapped in without touching the screens or the state machine.
 */
export interface StaticRecognizer {
  readonly id: string;
  /** null = no opinion (no model, or nothing close enough to any letter) */
  recognize(hand: HandObs, width: number, height: number, mirrorX: boolean): LetterGuess | null;
}

export interface MotionGuess {
  letter: string;
  /** 0..1, the $P match score */
  score: number;
}

/** A recognizer for signs that move (a path of one landmark over time). */
export interface MotionRecognizer {
  readonly id: string;
  /** which landmark's path the templates were recorded from */
  readonly landmark: number;
  recognize(path: { x: number; y: number }[]): MotionGuess | null;
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export class ModelError extends Error {}
