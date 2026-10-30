/**
 * Credit for the data the letter models were made from. The same facts are in docs/CREDITS.md (a test keeps the two in step).
 * Only what is certain is written here; the full citation of each dataset is copied from its own page into docs/CREDITS.md.
 */
export interface Credit {
  id: string;
  name: string;
  licence: string;
  licenceUrl: string;
  /** what the dataset was used for in this project */
  use: string;
  /** what was changed (CC BY asks for this to be said) */
  changes: string;
  /** in the shipped model files? */
  inShippedModel: boolean;
}

/** the address is written as text: the app is used with hand gestures, there is nothing to click */
export const LICENCE_TEXT = 'creativecommons.org/licenses/by/4.0';

const CC_BY_4 = {
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
};

export const CREDITS: readonly Credit[] = [
  {
    id: 'arsl21l',
    name: 'ArSL21L (Arabic Sign Language letters dataset)',
    ...CC_BY_4,
    use: 'trains and tests the Arabic (ArSL) letter model',
    changes:
      'the pictures were reduced to 21 hand points with MediaPipe; the model files hold numbers made from them, not pictures',
    inShippedModel: true,
  },
  {
    id: 'aslad',
    name: 'ASLAD-96K (Arabic sign language landmark dataset)',
    ...CC_BY_4,
    use: 'only used to test the model on other data; not in the shipped model',
    changes: 'none to the data; only its hand points were read',
    inShippedModel: false,
  },
];
