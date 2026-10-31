import { getAlphabet, REJECT_LABEL, type AlphabetConfig } from '../config/alphabet';
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

/**
 * Model files of an alphabet. ASL keeps the original names (letters-knn.json, letters-mlp.json); every other alphabet has its own
 * pair, letters-<id>-knn.json and letters-<id>-mlp.json (ArSL: letters-arsl-*.json), so one alphabet's model is never read as another's.
 */
export function letterModelUrls(alphabetId: string): { mlp: string; knn: string } {
  if (alphabetId === 'asl') return { mlp: LETTER_MLP_URL, knn: LETTER_MODEL_URL };
  const base = `${import.meta.env.BASE_URL}models/letters-${alphabetId}`;
  return { mlp: `${base}-mlp.json`, knn: `${base}-knn.json` };
}

/** a model must only know letters of the alphabet it is loaded for */
function checkLabels(labels: readonly string[], a: AlphabetConfig): void {
  const known = new Set([...a.static, ...a.dynamic, REJECT_LABEL]);
  const stranger = labels.find((l) => !known.has(l));
  if (stranger !== undefined)
    throw new ModelError(
      `The letter model has a letter ("${stranger}") that the ${a.id.toUpperCase()} alphabet does not: it was trained for another alphabet.`,
    );
}
export const MOTION_MODEL_URL = `${import.meta.env.BASE_URL}models/motion-dollar.json`;

/** the $1 model of an alphabet: ASL keeps motion-dollar.json (J, Z); every other alphabet has motion-<id>-dollar.json (ArSL: the dynamic controls) */
export const motionModelUrl = (alphabetId: string): string =>
  alphabetId === 'asl'
    ? MOTION_MODEL_URL
    : `${import.meta.env.BASE_URL}models/motion-${alphabetId}-dollar.json`;

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
export async function loadLetters(f: typeof fetch, alphabetId = 'asl'): Promise<LettersState> {
  const urls = letterModelUrls(alphabetId);
  const alphabet = getAlphabet(alphabetId);
  let mlpProblem = '';
  try {
    const raw = await fetchJson(urls.mlp, f);
    if (raw !== 'missing') {
      const m = parseMlpModel(raw);
      checkLabels(m.labels, alphabet);
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
    const raw = await fetchJson(urls.knn, f);
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
    checkLabels(m.labels, alphabet);
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
export async function loadModels(
  f: typeof fetch = fetch,
  alphabetId = 'asl',
): Promise<LoadedModels> {
  const out = noModels();
  out.letters = await loadLetters(f, alphabetId);
  // the motion model holds the drawn signs (J and Z, the dynamic controls): an alphabet with none has no motion model
  const alphabet = getAlphabet(alphabetId);
  if (alphabet.dynamic.length === 0) return out;
  try {
    const raw = await fetchJson(motionModelUrl(alphabetId), f);
    if (raw === 'missing') {
      out.motion = {
        status: 'missing',
        recognizer: null,
        message: 'No motion model yet.',
        synthetic: false,
      };
    } else {
      const m = parseDollarModel(raw);
      checkLabels(
        m.templates.map((t) => t.label),
        alphabet,
      );
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
