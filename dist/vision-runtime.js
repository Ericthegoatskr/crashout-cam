import { FaceLandmarker, HandLandmarker, FilesetResolver } from './vendor/mediapipe/vision_bundle.mjs';
import ModuleFactory from './vendor/mediapipe/wasm/vision_wasm_module_internal.js';
import { classify, Stabilizer } from './detection.js';

// Load the ES module ourselves: the default loader inserts a classic script on
// the main thread, and importScripts cannot load it in a module worker.
let initialization = Promise.resolve();
export function createDetector(config) {
  // A cancelled start may still be loading WASM; serialize factory ownership.
  const next = initialization.then(() => initialize(config));
  initialization = next.catch(() => {});
  return next;
}
async function initialize(initialConfig) {
  let config = initialConfig;
  const stabilizer = new Stabilizer(config);
  const files = await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm', import.meta.url).href, true);
  files.wasmLoaderPath = undefined;
  let face, hands;
  const options = model => ({
    baseOptions: { modelAssetPath: new URL(`./models/${model}_landmarker.task`, import.meta.url).href, delegate: 'CPU' },
    runningMode: 'VIDEO',
    // iOS Chrome's UA does not pass MediaPipe's Safari OffscreenCanvas check.
    // Supply an ordinary canvas explicitly when running on the main thread.
    ...(typeof document !== 'undefined' ? { canvas: document.createElement('canvas') } : {}),
  });
  try {
    self.ModuleFactory = ModuleFactory;
    face = await FaceLandmarker.createFromOptions(files, { ...options('face'), numFaces: 1, outputFaceBlendshapes: true });
    self.ModuleFactory = ModuleFactory;
    hands = await HandLandmarker.createFromOptions(files, { ...options('hand'), numHands: 2 });
    return {
      configure(next) { config = next; stabilizer.config = next; stabilizer.reset(); },
      detect(image, timestamp, aspect) {
        const result = face.detectForVideo(image, timestamp);
        const handResult = hands.detectForVideo(image, timestamp);
        const scores = Object.fromEntries((result.faceBlendshapes[0]?.categories ?? []).map(c => [c.categoryName, c.score]));
        const raw = classify(result.faceLandmarks[0], handResult.landmarks, scores, config, aspect, stabilizer.current);
        return { state: stabilizer.update(raw, timestamp), faceFound: raw !== null };
      },
      close() { face.close(); hands.close(); },
    };
  } catch (error) { face?.close(); hands?.close(); throw error; }
}

export function preferMainThread(nav = navigator) {
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}
