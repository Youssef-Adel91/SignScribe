export type CameraErrorKind = 'denied' | 'nocamera' | 'error';

export class CameraError extends Error {
  constructor(
    readonly kind: CameraErrorKind,
    message: string,
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
    );
  return new CameraError('error', `The camera could not start (${name || 'unknown error'}).`);
}

export async function openCamera(): Promise<OpenCamera> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError(
      'error',
      'This browser cannot use the camera here. Use https or localhost in a current browser.',
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
