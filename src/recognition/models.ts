import { DollarRecognizer, parseDollarModel } from './dollarP';
import { KnnRecognizer, parseKnnModel } from './knn';
import { MlpRecognizer, parseMlpModel } from './mlp';
import {
  ModelError,
  type ModelStatus,
  type MotionRecognizer,
  type StaticRecognizer,
} from './types';

export const LETTER_MODEL_URL = `${import.meta.env.BASE_URL}models/letters-knn.json`;
/** the neural network is tried first; the k-NN file is the fallback when it is missing or broken */
export const LETTER_MLP_URL = `${import.meta.env.BASE_URL}models/letters-mlp.json`;
export const MOTION_MODEL_URL = `${import.meta.env.BASE_URL}models/motion-dollar.json`;

export interface LoadedModels {
  letters: {
    status: ModelStatus;
    recognizer: StaticRecognizer | null;
    message: string;
    synthetic: boolean;
  };
  motion: {
    status: ModelStatus;
    recognizer: MotionRecognizer | null;
    message: string;
    synthetic: boolean;
  };
}

export const noModels = (): LoadedModels => ({
  letters: { status: 'idle', recognizer: null, message: '', synthetic: false },
  motion: { status: 'idle', recognizer: null, message: '', synthetic: false },
});

async function fetchJson(url: string, f: typeof fetch): Promise<unknown | 'missing'> {
  const res = await f(url, { cache: 'no-cache' });
  // a dev server answers an unknown path with index.html: treat that like a missing file
  const type = res.headers.get('content-type') ?? '';
  if (res.status === 404 || type.includes('text/html')) return 'missing';
  if (!res.ok) throw new ModelError(`The model file could not be loaded (HTTP ${res.status}).`);
  try {
    return await res.json();
  } catch {
    throw new ModelError('The model file is not valid JSON.');
  }
}

type LettersState = LoadedModels['letters'];

/**
 * Letters: the neural network (letters-mlp.json) if it is there and valid, else the k-NN (letters-knn.json). A broken neural
 * network falls back to the k-NN without stopping the app; with no k-NN either, the error is reported.
 */
export async function loadLetters(f: typeof fetch): Promise<LettersState> {
  let mlpProblem = '';
  try {
    const raw = await fetchJson(LETTER_MLP_URL, f);
    if (raw !== 'missing') {
      const m = parseMlpModel(raw);
      return {
        status: 'ready',
        recognizer: new MlpRecognizer(m),
        message: '',
        synthetic: m.meta.synthetic,
      };
    }
  } catch (e) {
    mlpProblem = e instanceof Error ? e.message : String(e);
    console.warn(`letters-mlp.json could not be used (${mlpProblem}); trying letters-knn.json`);
  }
  try {
    const raw = await fetchJson(LETTER_MODEL_URL, f);
    if (raw === 'missing')
      return mlpProblem
        ? { status: 'error', recognizer: null, message: mlpProblem, synthetic: false }
        : {
            status: 'missing',
            recognizer: null,
            message: 'No letter model yet.',
            synthetic: false,
          };
    const m = parseKnnModel(raw);
    return {
      status: 'ready',
      recognizer: new KnnRecognizer(m),
      message: '',
      synthetic: m.meta.synthetic,
    };
  } catch (e) {
    return {
      status: 'error',
      recognizer: null,
      message: e instanceof Error ? e.message : String(e),
      synthetic: false,
    };
  }
}

/** Loads whichever model files exist. A missing file is normal (no model trained yet); a broken file is reported. */
export async function loadModels(f: typeof fetch = fetch): Promise<LoadedModels> {
  const out = noModels();
  out.letters = await loadLetters(f);
  try {
    const raw = await fetchJson(MOTION_MODEL_URL, f);
    if (raw === 'missing') {
      out.motion = {
        status: 'missing',
        recognizer: null,
        message: 'No motion model yet.',
        synthetic: false,
      };
    } else {
      const m = parseDollarModel(raw);
      out.motion = {
        status: 'ready',
        recognizer: new DollarRecognizer(m),
        message: '',
        synthetic: m.meta.synthetic,
      };
    }
  } catch (e) {
    out.motion = {
      status: 'error',
      recognizer: null,
      message: e instanceof Error ? e.message : String(e),
      synthetic: false,
    };
  }
  return out;
}
