// src/vision/gestureDetector.js
// Converts raw MediaPipe landmarks into semantic gesture signals:
// pinch, openness, depth, rotation, and swipe direction.

const HISTORY_LENGTH = 5; // frames kept for swipe velocity calculation
const wristHistory = [];

const PINCH_THRESHOLD = 0.06;   // normalized distance; tune after testing
const SWIPE_VELOCITY_THRESHOLD = 0.035; // normalized units/frame
const SWIPE_COOLDOWN_MS = 800;
let lastSwipeTime = 0;

/**
 * Computes Euclidean distance between two normalized landmarks.
 */
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

/**
 * Main entry: takes landmarks (21 points) and returns a gesture state object.
 * Returns null if no hand is present.
 */
export function analyzeGesture(landmarks) {
  if (!landmarks) {
    wristHistory.length = 0; // reset history when hand disappears
    return null;
  }

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];

  // --- Pinch detection ---
  const pinchDistance = dist(thumbTip, indexTip);
  const isPinching = pinchDistance < PINCH_THRESHOLD;

  // --- Hand openness (0 = closed fist, 1 = fully open) ---
  const openness = calculateOpenness(landmarks);

  // --- Depth / distance from camera (smaller hand bbox = farther away) ---
  const depth = estimateDepth(landmarks);

  // --- Rotation (radians, wrist -> middle MCP vector angle) ---
  const rotation = Math.atan2(
    middleMcp.y - wrist.y,
    middleMcp.x - wrist.x
  );

  // --- Swipe detection (based on wrist X velocity) ---
  const swipe = detectSwipe(wrist);

  return {
    isPinching,
    pinchDistance,
    openness,
    depth,
    rotation,
    swipe, // 'left' | 'right' | null
  };
}

/**
 * Openness based on actual finger-curl angles (index/middle/ring/pinky),
 * not raw fingertip-to-wrist distance. A bent finger has a sharp angle at
 * its PIP joint; a straight finger is close to 180°. This is what makes it
 * robust: the angle barely changes when the hand moves toward the camera
 * or tilts down, whereas a flat distance-ratio metric spikes under that
 * same perspective foreshortening (this was causing false blooms when
 * moving the hand forward/downward).
 */
function calculateOpenness(landmarks) {
  // [MCP, PIP, TIP] triplets for each of the 4 fingers (thumb excluded —
  // it bends on a different axis and is a weaker/noisier signal here).
  const fingers = [
    [5, 6, 8],    // index
    [9, 10, 12],  // middle
    [13, 14, 16], // ring
    [17, 18, 20], // pinky
  ];

  const extensions = fingers.map(([mcp, pip, tip]) =>
    fingerExtension(landmarks[mcp], landmarks[pip], landmarks[tip])
  );

  const openness = extensions.reduce((sum, e) => sum + e, 0) / extensions.length;
  return clamp(openness, 0, 1);
}

/**
 * Extension of a single finger, from the bend angle at its PIP joint.
 * ~180° (straight) -> 1 (fully extended). ~70° or less (curled) -> 0.
 */
function fingerExtension(mcp, pip, tip) {
  const v1 = { x: mcp.x - pip.x, y: mcp.y - pip.y, z: (mcp.z || 0) - (pip.z || 0) };
  const v2 = { x: tip.x - pip.x, y: tip.y - pip.y, z: (tip.z || 0) - (pip.z || 0) };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.hypot(v1.x, v1.y, v1.z) || 0.0001;
  const mag2 = Math.hypot(v2.x, v2.y, v2.z) || 0.0001;

  const cosAngle = clamp(dot / (mag1 * mag2), -1, 1);
  const angleDeg = Math.acos(cosAngle) * (180 / Math.PI);

  // Map ~70deg (curled) - ~175deg (straight) onto 0-1.
 return clamp((angleDeg - 55) / (160 - 55), 0, 1);
}

/**
 * Depth estimate: uses the bounding box diagonal of all landmarks.
 * Larger diagonal = hand closer to camera. Normalized empirically.
 */
function estimateDepth(landmarks) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  landmarks.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  // Typical range ~0.15 (far) to ~0.5 (close) — tune after testing your setup
  return clamp((diagonal - 0.15) / (0.5 - 0.15), 0, 1);
}

/**
 * Tracks wrist X position over recent frames to detect a fast horizontal swipe.
 */
function detectSwipe(wrist) {
  wristHistory.push({ x: wrist.x, t: performance.now() });
  if (wristHistory.length > HISTORY_LENGTH) wristHistory.shift();

  if (wristHistory.length < HISTORY_LENGTH) return null;

  const first = wristHistory[0];
  const last = wristHistory[wristHistory.length - 1];
  const dt = last.t - first.t;
  if (dt === 0) return null;

  const velocity = (last.x - first.x) / (dt / 16.67); // normalize to ~per-frame at 60fps

  const now = performance.now();
  if (now - lastSwipeTime < SWIPE_COOLDOWN_MS) return null;

  if (velocity > SWIPE_VELOCITY_THRESHOLD) {
    lastSwipeTime = now;
    wristHistory.length = 0;
    return 'right'; // note: video is mirrored, this matches user's actual right-swipe
  }
  if (velocity < -SWIPE_VELOCITY_THRESHOLD) {
    lastSwipeTime = now;
    wristHistory.length = 0;
    return 'left';
  }
  return null;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}