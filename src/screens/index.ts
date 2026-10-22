import type { ComponentType } from 'react';
import S01Welcome from './S01Welcome';
import S02CameraCheck from './S02CameraCheck';
import S03Preferences from './S03Preferences';
import S04Context from './S04Context';
import S05Method from './S05Method';
import S06SpellReady from './S06SpellReady';
import S07SpellRecognizing from './S07SpellRecognizing';
import S08HandLost from './S08HandLost';
import S09WordSuggestion from './S09WordSuggestion';
import S10PictureCard from './S10PictureCard';
import S11ReviewSentence from './S11ReviewSentence';
import S12Share from './S12Share';
import S13GestureGuide from './S13GestureGuide';
import S14Comfort from './S14Comfort';

/** Index = screen number - 1. */
export const SCREENS: ComponentType[] = [
  S01Welcome,
  S02CameraCheck,
  S03Preferences,
  S04Context,
  S05Method,
  S06SpellReady,
  S07SpellRecognizing,
  S08HandLost,
  S09WordSuggestion,
  S10PictureCard,
  S11ReviewSentence,
  S12Share,
  S13GestureGuide,
  S14Comfort,
];
