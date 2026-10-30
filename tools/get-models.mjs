// Prepares public/models for the hand tracker. Run once on a machine with internet: `npm run models`
//  - copies the MediaPipe WebAssembly runtime out of node_modules (no download needed)
//  - downloads the HandLandmarker model (float16, about 7.5 MB) from Google's model storage
//  - downloads the PoseLandmarker lite model (about 6 MB), used only by the Python tool tools/dollarpy (optional: a failure here is not fatal)
// Nothing here is committed: public/models is in .gitignore.
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'public/models');
const wasmOut = join(out, 'wasm');
mkdirSync(wasmOut, { recursive: true });

const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
if (!existsSync(src)) {
  console.error('node_modules/@mediapipe/tasks-vision is missing. Run `npm ci` first.');
  process.exit(1);
}
for (const f of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) {
  copyFileSync(join(src, f), join(wasmOut, f));
  console.log(`copied  wasm/${f}  (${(statSync(join(wasmOut, f)).size / 1e6).toFixed(1)} MB)`);
}

// ONNX Runtime Web (runs the card detector): copy its WebAssembly files, no download needed
{
  const ortSrc = join(root, 'node_modules/onnxruntime-web/dist');
  const ortOut = join(out, 'ort');
  mkdirSync(ortOut, { recursive: true });
  for (const f of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
    if (!existsSync(join(ortSrc, f))) {
      console.error(`node_modules/onnxruntime-web/dist/${f} is missing. Run \`npm ci\` first.`);
      process.exit(1);
    }
    copyFileSync(join(ortSrc, f), join(ortOut, f));
    console.log(`copied  ort/${f}  (${(statSync(join(ortOut, f)).size / 1e6).toFixed(1)} MB)`);
  }
}

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const target = join(out, 'hand_landmarker.task');
if (existsSync(target) && statSync(target).size > 1e6) {
  console.log(
    `kept    hand_landmarker.task (${(statSync(target).size / 1e6).toFixed(1)} MB), already there`,
  );
} else {
  console.log(`downloading ${MODEL_URL}`);
  let res;
  try {
    res = await fetch(MODEL_URL);
  } catch (e) {
    console.error(`Could not reach the model server: ${e.message}`);
    console.error(`Download it in a browser and save it as ${target}`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(
      `Download failed: HTTP ${res.status}. Save the file from the URL above as ${target}`,
    );
    process.exit(2);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1e6) {
    console.error(`Downloaded file is only ${buf.length} bytes, which is not a model. Not saved.`);
    process.exit(2);
  }
  writeFileSync(target, buf);
  console.log(`saved   hand_landmarker.task (${(buf.length / 1e6).toFixed(1)} MB)`);
}
// Pose model for tools/dollarpy (the body skeleton next to the hand). The web app does not use it; the download may fail without harm.
{
  const POSE_URL =
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
  const poseTarget = join(out, 'pose_landmarker_lite.task');
  if (existsSync(poseTarget) && statSync(poseTarget).size > 1e6) {
    console.log(
      `kept    pose_landmarker_lite.task (${(statSync(poseTarget).size / 1e6).toFixed(1)} MB), already there`,
    );
  } else {
    try {
      console.log(`downloading ${POSE_URL}`);
      const r = await fetch(POSE_URL);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      writeFileSync(poseTarget, Buffer.from(await r.arrayBuffer()));
      console.log(
        `saved   pose_landmarker_lite.task (${(statSync(poseTarget).size / 1e6).toFixed(1)} MB)`,
      );
    } catch (e) {
      console.warn(
        `could not get the pose model (${e.message}); tools/dollarpy then needs --no-pose`,
      );
    }
  }
}
console.log('Done. Start the app with `npm run dev`.');
