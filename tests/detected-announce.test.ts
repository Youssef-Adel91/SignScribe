import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDetectedAnnouncement, shouldAnnounceDetected } from '../src/ui/detectedAnnounce';

describe('"Bluetooth found" is said once per detection', () => {
  beforeEach(resetDetectedAnnouncement);

  it('the first sighting is announced, a rebuilt chip with the same text is not', () => {
    expect(shouldAnnounceDetected('Bluetooth found youssef')).toBe(true);
    // every screen change or letter builds the chip again with the same text
    for (let i = 0; i < 5; i++)
      expect(shouldAnnounceDetected('Bluetooth found youssef')).toBe(false);
  });

  it('a different person or place is announced', () => {
    shouldAnnounceDetected('Bluetooth found youssef');
    expect(shouldAnnounceDetected('Bluetooth found youssef at Clinic')).toBe(true);
  });

  it('after the person was lost, coming back is announced again', () => {
    shouldAnnounceDetected('Bluetooth found youssef');
    expect(shouldAnnounceDetected(null)).toBe(false);
    expect(shouldAnnounceDetected('Bluetooth found youssef')).toBe(true);
  });

  it('the chip uses it instead of announce-on-mount', () => {
    const src = readFileSync(join(process.cwd(), 'src/ui/DetectedChip.tsx'), 'utf8');
    expect(src).toContain('shouldAnnounceDetected');
    expect(src).not.toContain('useAnnounceOnChange');
  });
});
