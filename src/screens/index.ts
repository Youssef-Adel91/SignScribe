import type { ComponentType } from 'react';
import S01 from './S01Welcome';
import S02 from './S02CameraCheck';
import S03 from './S03Preferences';
import S04 from './S04Context';
import S05 from './S05Method';
import S06 from './S06SpellReady';
import S07 from './S07SpellRecognizing';
import S08 from './S08HandLost';
import S09 from './S09WordSuggestion';
import S10 from './S10PictureCard';
import S11 from './S11ReviewSentence';
import S12 from './S12Share';
import S13 from './S13GestureGuide';

export const SCREENS: { name: string; Component: ComponentType }[] = [
  { name: '01 Welcome', Component: S01 },
  { name: '02 Camera check', Component: S02 },
  { name: '03 Preferences', Component: S03 },
  { name: '04 Context', Component: S04 },
  { name: '05 Method', Component: S05 },
  { name: '06 Spell ready', Component: S06 },
  { name: '07 Spell recognizing', Component: S07 },
  { name: '08 Hand lost', Component: S08 },
  { name: '09 Word suggestion', Component: S09 },
  { name: '10 Picture card', Component: S10 },
  { name: '11 Review sentence', Component: S11 },
  { name: '12 Share', Component: S12 },
  { name: '13 Gesture guide', Component: S13 },
];
