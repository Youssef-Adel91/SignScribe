export type CameraErrorKind = 'denied' | 'nocamera' | 'error';

/** what went wrong, as a code the screen turns into a sentence in the person's language (strings.ts: cameraProblem*) */
export type CameraProblem =
  'denied' | 'nocamera' | 'inuse' | 'unsupported' | 'insecure' | 'unknown';

export class CameraError extends Error {
  constructor(
    readonly kind: CameraErrorKind,
    message: string,
    /** same situation as `kind` but finer; the banner uses it for the translated text */
    readonly problem: CameraProblem = 'unknown',
  ) {
    super(message);
  }
}

export interface OpenCamera {
  stream: MediaStream;
  /** hidden <video> the hand model reads from */
  video: HTMLVideoElement;
  width: number;
  height: number;
  stop: () => void;
}

/** Turn the browser's getUserMedia errors into the three situations the user can act on. */
export function classifyCameraError(e: unknown): CameraError {
  const name = e instanceof DOMException || e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError')
    return new CameraError(
      'denied',
      'Camera access is blocked. Allow the camera for this page in the browser, then reload.',
      'denied',
    );
  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'NotReadableError' ||
    name === 'AbortError'
  )
    return new CameraError(
      'nocamera',
      name === 'NotReadableError'
        ? 'The camera is in use by another app. Close it and reload.'
        : 'No camera found. Connect a camera and reload.',
      name === 'NotReadableError' ? 'inuse' : 'nocamera',
    );
  // NotSupportedError (some browsers, or a page that is not secure) and anything we do not know: one plain, specific sentence
  if (name === 'NotSupportedError' || name === 'TypeError')
    return new CameraError(
      'error',
      'The camera is not available in this browser or on this page. Open the app at localhost or https, or use a normal browser window.',
      'unsupported',
    );
  return new CameraError(
    'error',
    'The camera could not start for an unknown reason. Reload the page, or try another browser window.',
    'unknown',
  );
}

export async function openCamera(): Promise<OpenCamera> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError(
      'error',
      'This browser cannot use the camera here. Use https or localhost in a current browser.',
      'insecure',
    );
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
  } catch (e) {
    throw classifyCameraError(e);
  }
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await video.play();
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw classifyCameraError(e);
  }
  if (video.videoWidth === 0) {
    await new Promise<void>((resolve) =>
      video.addEventListener('loadedmetadata', () => resolve(), { once: true }),
    );
  }
  return {
    stream,
    video,
    width: video.videoWidth,
    height: video.videoHeight,
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
