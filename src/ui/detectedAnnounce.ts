/**
 * "Bluetooth found youssef" is said ONCE per detection, not every time a screen is built again.
 * The chip lives inside every screen's top bar, and the spelling flow moves between screens with each letter, so a plain
 * announce-on-mount said it again with every letter. The last announced text is kept here, outside any component.
 * When nothing is detected the memory is cleared, so a person who left and came back is welcomed again.
 */
let last: string | null = null;

export function shouldAnnounceDetected(text: string | null): boolean {
  if (!text) {
    last = null;
    return false;
  }
  if (text === last) return false;
  last = text;
  return true;
}

/** for tests */
export function resetDetectedAnnouncement(): void {
  last = null;
}
