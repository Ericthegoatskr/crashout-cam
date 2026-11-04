import { FaceLandmarker, HandLandmarker, FilesetResolver } from './vendor/mediapipe/vision_bundle.mjs';
import { classify, Stabilizer } from './detection.js';

// Module workers cannot use importScripts. Rebind the cached module factory for
// each task because MediaPipe clears it after constructing a graph.
self.import = async url => { self.ModuleFactory = (await import(url)).default; };
let faceModel, handModel, config, stabilizer;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      config = data.config;
      stabilizer = new Stabilizer(config);
      const files = await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm', self.location.href).href, true);
      faceModel = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./models/face_landmarker.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
      });
      handModel = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./models/hand_landmarker.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 2,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
  } else if (data.type === 'config') {
    config = data.config;
    stabilizer.config = config;
    stabilizer.reset();
  } else if (data.type === 'frame') {
    try {
      const face = faceModel.detectForVideo(data.bitmap, data.timestamp);
      const hands = handModel.detectForVideo(data.bitmap, data.timestamp);
      const scores = Object.fromEntries((face.faceBlendshapes[0]?.categories ?? []).map(c => [c.categoryName, c.score]));
      const raw = classify(face.faceLandmarks[0], hands.landmarks, scores, config, data.aspect, stabilizer.current);
      self.postMessage({ type: 'result', state: stabilizer.update(raw, data.timestamp), faceFound: raw !== null });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
    finally { data.bitmap.close(); }
  }
};
