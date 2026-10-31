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
  const fired = eventTypes.some((e) => COMMAND_EVENTS.has(e));
  if (!ui) return { active: fired, fired };
  const holding = ui.command.label !== null || ui.command.progress > 0;
  const zoneHand = ui.handViews.some((h) => h.inZone && h.gesture !== 'none');
  let pointerInZone = false;
  if (ui.pointer && viewportW > 0) {
    const x = ui.pointer.x / viewportW;
    pointerInZone = zoneSide(signing) === 'left' ? x <= ZONE_EDGE : x >= 1 - ZONE_EDGE;
  }
  return { active: fired || holding || zoneHand || pointerInZone, fired };
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
