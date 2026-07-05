// src/main.js
// Entry point — orchestrates all modules (scene, vision, flower, effects).

import { initScene, scene, camera, registerUpdate } from './core/scene.js';
import { initWebcam } from './vision/webcam.js';
import { initHandTracker, startDetection, onHandResults } from './vision/handTracker.js';
import { initDebugOverlay, drawLandmarks } from './vision/debugOverlay.js';
import { analyzeGesture } from './vision/gestureDetector.js';
import { updateFlowerTarget, tickFlower, resetFlower } from './flower/flowerController.js';

const statusText = document.getElementById('status-text');

async function init() {
  initScene();

  // Guarantee a fully clean state on every fresh app load —
  // eliminates any chance of leftover flower state from a prior session.
  resetFlower(scene);

  statusText.textContent = 'Requesting webcam access...';

  try {
    const video = await initWebcam();
    initDebugOverlay(video);

    statusText.textContent = 'Loading hand tracking model...';
    await initHandTracker();

    onHandResults((landmarks) => {
      drawLandmarks(landmarks);
      const gesture = analyzeGesture(landmarks);
      updateFlowerTarget(scene, gesture, landmarks, camera, video);

      statusText.textContent = gesture
        ? `pinch:${gesture.isPinching} open:${gesture.openness.toFixed(2)}`
        : 'No hand detected';
    });

    registerUpdate((delta) => tickFlower(delta));
    startDetection(video);

    // DEBUG ONLY: press "R" to instantly force a clean reset while testing.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        resetFlower(scene);
        console.log('[DEBUG] Flower force-reset');
      }
    });
  } catch (err) {
    console.error('[Magic Rose] Error:', err);
    statusText.textContent = 'Error: ' + err.message;
  }
}

init();