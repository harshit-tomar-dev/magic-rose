// src/vision/handTracker.js
// Loads MediaPipe HandLandmarker and runs continuous detection on webcam frames.

import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let handLandmarker;
let lastVideoTime = -1;
const frameCallbacks = []; // subscribers that want landmark results each frame

/**
 * Loads the HandLandmarker model. Must be awaited before starting detection.
 */
export async function initHandTracker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1, // single-hand control keeps gestures unambiguous
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  console.log('[HandTracker] Model loaded');
}

/**
 * Starts a per-frame detection loop against the given video element.
 * Calls every registered callback with the latest landmarks (or null if no hand found).
 */
export function startDetection(video) {
  function detectFrame() {
    if (!handLandmarker) return;

    // Only run inference on new frames (avoids duplicate work)
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const nowMs = performance.now();
      const results = handLandmarker.detectForVideo(video, nowMs);

      const landmarks =
        results.landmarks && results.landmarks.length > 0
          ? results.landmarks[0]
          : null;

      const handedness =
        results.handedness && results.handedness.length > 0
          ? results.handedness[0][0].categoryName
          : null;

      frameCallbacks.forEach((cb) => cb(landmarks, handedness));
    }

    requestAnimationFrame(detectFrame);
  }

  requestAnimationFrame(detectFrame);
}

/** Register a callback to receive (landmarks, handedness) every frame. */
export function onHandResults(callback) {
  frameCallbacks.push(callback);
}