import { createDetector } from './vision-runtime.js';

let detector;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      detector = await createDetector(data.config);
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
  } else if (data.type === 'config') {
    detector.configure(data.config);
  } else if (data.type === 'frame') {
    try {
      self.postMessage({ type: 'result', ...detector.detect(data.bitmap, data.timestamp, data.aspect) });
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }); }
    finally { data.bitmap.close(); }
  }
};
