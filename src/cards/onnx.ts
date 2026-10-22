import { CARD_CLASSES } from '../screens/cardPack';
import { DEFAULT_DECODE, decodeYolo, letterbox, toTensor } from './yolo';
import type { CardDetector, Detection } from './types';

export const CARDS_MODEL_URL = `${import.meta.env.BASE_URL}models/cards.onnx`;
export const CARDS_META_URL = `${import.meta.env.BASE_URL}models/cards.json`;
// onnxruntime-web fetches its WebAssembly from inside a script in assets/, so the path must not depend on the script's own address
const ortWasmPath = () => new URL(`${import.meta.env.BASE_URL}models/ort/`, document.baseURI).href;

/** `cards.json`, written next to the ONNX file by ml/cards/export_onnx.py (docs/CARDS.md) */
export interface CardsMeta {
  format: 'signscribe-cards';
  version: 1;
  classes: string[];
  inputSize: number;
  output: 'yolov8';
  meta: {
    trainedAt: string;
    datasetSha256: string;
    images: number;
    synthetic: boolean;
    evaluation: Record<string, unknown> | null;
  };
}

export class CardModelError extends Error {}

export function parseCardsMeta(raw: unknown): CardsMeta {
  const m = raw as Partial<CardsMeta> | null;
  if (!m || typeof m !== 'object')
    throw new CardModelError('The card model description is not valid JSON data.');
  if (m.format !== 'signscribe-cards' || m.version !== 1)
    throw new CardModelError('This is not a SignScribe card model description (version 1).');
  if (m.output !== 'yolov8')
    throw new CardModelError(
      `Unsupported detector output "${String(m.output)}"; the app reads YOLOv8-style output.`,
    );
  if (
    !Number.isInteger(m.inputSize) ||
    (m.inputSize as number) < 32 ||
    (m.inputSize as number) % 32 !== 0
  )
    throw new CardModelError('The card model needs an input size that is a multiple of 32.');
  if (!Array.isArray(m.classes) || m.classes.length === 0)
    throw new CardModelError('The card model lists no classes.');
  if (m.classes.length !== CARD_CLASSES.length || m.classes.some((c, i) => c !== CARD_CLASSES[i]))
    throw new CardModelError(
      'The card model classes differ from src/data/contexts.json. Retrain with the current class list (docs/CARDS.md).',
    );
  if (!m.meta || typeof m.meta !== 'object')
    throw new CardModelError('The card model has no metadata.');
  return m as CardsMeta;
}

type Ort = typeof import('onnxruntime-web/wasm');

/** YOLOv8-style detector run with onnxruntime-web (WebAssembly, one thread: no special server headers needed). */
export class OnnxCardDetector implements CardDetector {
  readonly id = 'onnx-yolov8';
  private canvas: HTMLCanvasElement | null = null;
  private constructor(
    private readonly ort: Ort,
    private readonly session: import('onnxruntime-web/wasm').InferenceSession,
    readonly meta: CardsMeta,
  ) {}

  static async create(
    f: typeof fetch = fetch,
  ): Promise<{ detector: OnnxCardDetector } | { missing: true }> {
    const res = await f(CARDS_META_URL, { cache: 'no-cache' });
    const type = res.headers.get('content-type') ?? '';
    if (res.status === 404 || type.includes('text/html')) return { missing: true };
    if (!res.ok)
      throw new CardModelError(
        `The card model description could not be loaded (HTTP ${res.status}).`,
      );
    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new CardModelError('The card model description is not valid JSON.');
    }
    const meta = parseCardsMeta(raw);
    // the wasm-only build: no WebGPU files to ship
    const ort = await import('onnxruntime-web/wasm');
    ort.env.wasm.wasmPaths = ortWasmPath();
    ort.env.wasm.numThreads = 1;
    let session;
    try {
      session = await ort.InferenceSession.create(CARDS_MODEL_URL, {
        executionProviders: ['wasm'],
      });
    } catch (e) {
      throw new CardModelError(
        `The card model file could not be opened: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return { detector: new OnnxCardDetector(ort, session, meta) };
  }

  async detect(source: CanvasImageSource, width: number, height: number): Promise<Detection[]> {
    const size = this.meta.inputSize;
    const lb = letterbox(width, height, size);
    const c = (this.canvas ??= Object.assign(document.createElement('canvas'), {
      width: size,
      height: size,
    }));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = 'rgb(114,114,114)';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(source, lb.padX, lb.padY, width * lb.scale, height * lb.scale);
    const input = new this.ort.Tensor(
      'float32',
      toTensor(ctx.getImageData(0, 0, size, size).data, size),
      [1, 3, size, size],
    );
    const out = await this.session.run({ [this.session.inputNames[0]]: input });
    const t = out[this.session.outputNames[0]];
    return decodeYolo(t.data as Float32Array, t.dims, lb, {
      classes: this.meta.classes.length,
      ...DEFAULT_DECODE,
    });
  }

  close(): void {
    void this.session.release();
  }
}
