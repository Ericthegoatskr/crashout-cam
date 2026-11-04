// Pure geometry/state rules; mirrored in python/detection.py and tested with shared fixtures.
export function classify(face, hands, scores, config, aspect = 4 / 3, previous = 'neutral') {
  if (!face?.length) return null;
  const dist = (a, b) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const [left, right] = [face[234], face[454]].sort((a, b) => a.x - b.x);
  const width = dist(left, right);
  if (width < 0.02) return null;
  const middleX = (left.x + right.x) / 2;
  // Use palm + knuckles, not fingertips: pointing near the face shouldn't count.
  const nearby = hands.map(hand => {
    const palm = [0, 5, 9, 13, 17].map(i => hand[i]);
    const centerX = palm.reduce((n, p) => n + p.x, 0) / palm.length;
    const radius = config.handDistance * width;
    return {
      left: centerX < middleX && palm.some(p => dist(p, left) < radius),
      right: centerX > middleX && palm.some(p => dist(p, right) < radius),
    };
  });
  // Require two distinct hands, one on each side of the head.
  if (nearby.some((h, i) => h.left && nearby.some((other, j) => j !== i && other.right))) return 'overload';
  if (nearby.some(h => h.left || h.right)) return 'listen';
  const jaw = scores.jawOpen ?? 0;
  const smile = ((scores.mouthSmileLeft ?? 0) + (scores.mouthSmileRight ?? 0)) / 2;
  if (jaw >= config.jawThreshold * (previous === 'shock' ? config.releaseRatio : 1)) return 'shock';
  if (smile >= config.smileThreshold * (previous === 'happy' ? config.releaseRatio : 1)) return 'happy';
  return 'neutral';
}

export class Stabilizer {
  constructor(config) { this.config = config; this.reset(); }
  reset() { this.current = 'neutral'; this.candidate = 'neutral'; this.since = 0; this.missingSince = null; }
  update(raw, now) {
    if (raw === null) {
      this.candidate = this.current;
      this.since = now;
      if (this.missingSince === null) this.missingSince = now;
      if (now - this.missingSince >= this.config.lostFaceMs) this.current = 'neutral';
      return this.current;
    }
    this.missingSince = null;
    if (raw !== this.candidate) { this.candidate = raw; this.since = now; }
    if (raw !== this.current && now - this.since >= this.config.holdMs) this.current = raw;
    return this.current;
  }
}
