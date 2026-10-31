import type { Hand } from '../state/machine';
import { ZONE_EDGE, zoneSide } from '../vision/zones';
import type { VisionUI } from '../vision/controller';
import type { CommandState } from './letterController';

/**
 * Does a command have priority over letters right now? True when
 *  - a control gesture is recognised and being held (delete, space, finish, cancel), or one was just sent, or
 *  - the pointer is inside the command zone, or
 *  - a hand in the command zone shows a recognised pose (a relaxed zone hand with no pose does not block the signing hand).
 * `eventTypes` are the events the gesture controller sent on THIS frame: if one of them is a command, `fired` is true, and the
 * caller must not send any letter event of the same frame (see dropLettersWithCommand).
 */
const COMMAND_EVENTS = new Set([
  'SPACE',
  'DELETE',
  'YES',
  'NO',
  'FINISH',
  'NEW_SENTENCE',
  'EDIT',
  'HELP_TOGGLE',
]);

export function commandState(
  ui: VisionUI | null,
  eventTypes: readonly string[],
  signing: Hand,
  viewportW: number,
): CommandState {
  const firedType = eventTypes.find((e) => COMMAND_EVENTS.has(e));
  const fired = firedType !== undefined;
  if (!ui) return { active: fired, fired, ...(fired ? { label: firedType, score: 1 } : {}) };
  const holding = ui.command.label !== null || ui.command.progress > 0;
  const zoneHand = ui.handViews.find((h) => h.inZone && h.gesture !== 'none');
  let pointerInZone = false;
  if (ui.pointer && viewportW > 0) {
    const x = ui.pointer.x / viewportW;
    pointerInZone = zoneSide(signing) === 'left' ? x <= ZONE_EDGE : x >= 1 - ZONE_EDGE;
  }
  const active = fired || holding || zoneHand !== undefined || pointerInZone;
  // which old rule gesture it is and how sure the gesture engine is: shown in the debug overlay and its log
  const label = ui.command.label ?? zoneHand?.gesture ?? (pointerInZone ? 'pointer' : firedType);
  const score = zoneHand ? zoneHand.confidence : fired ? 1 : 0;
  return { active, fired, ...(active && label ? { label, score } : {}) };
}

const LETTER_EVENTS = new Set(['LETTER_CANDIDATE', 'LETTER_CONFIRMED']);

/**
 * One frame must not trigger both a command and a letter: when the frame's events hold a command, every letter event of that frame
 * is removed (CANDIDATE_LOST stays: it only clears the screen).
 */
export function dropLettersWithCommand<T extends { type: string }>(
  commandEvents: readonly T[],
  letterEvents: readonly T[],
): T[] {
  const hasCommand = commandEvents.some((e) => COMMAND_EVENTS.has(e.type));
  return hasCommand ? letterEvents.filter((e) => !LETTER_EVENTS.has(e.type)) : [...letterEvents];
}
