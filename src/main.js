// src/main.js
// Entry point — orchestrates all modules (scene, vision, flower, effects) and UI HUD.

import { initScene, scene, camera, registerUpdate } from './core/scene.js';
import { initWebcam } from './vision/webcam.js';
import { initHandTracker, startDetection, onHandResults } from './vision/handTracker.js';
import { initDebugOverlay, drawLandmarks, toggleDebugOverlay, isDebugEnabled } from './vision/debugOverlay.js';
import { analyzeGesture } from './vision/gestureDetector.js';
import { updateFlowerTarget, tickFlower, resetFlower, getFlowerState } from './flower/flowerController.js';

// DOM Elements
const statusIcon = document.getElementById('status-icon');
const statusText = document.getElementById('status-text');
const statusSubtext = document.getElementById('status-subtext');
const debugTelemetry = document.getElementById('debug-telemetry');
const telePinch = document.getElementById('tele-pinch');
const teleOpen = document.getElementById('tele-open');
const teleDepth = document.getElementById('tele-depth');

const guideCard = document.getElementById('guide-card');
const btnToggleGuide = document.getElementById('btn-toggle-guide');
const btnCloseGuide = document.getElementById('btn-close-guide');
const btnToggleDebug = document.getElementById('btn-toggle-debug');
const btnReset = document.getElementById('btn-reset');

function setStatus(icon, title, subtitle) {
  if (statusIcon && icon) statusIcon.textContent = icon;
  if (statusText && title) statusText.textContent = title;
  if (statusSubtext && subtitle) statusSubtext.textContent = subtitle;
}

function updateTelemetryDisplay(gesture) {
  if (!debugTelemetry) return;
  const isDebug = isDebugEnabled();
  debugTelemetry.style.display = isDebug ? 'flex' : 'none';
  if (btnToggleDebug) {
    btnToggleDebug.classList.toggle('active', isDebug);
  }

  if (isDebug && gesture) {
    if (telePinch) telePinch.textContent = gesture.isPinching ? 'YES' : 'NO';
    if (teleOpen) teleOpen.textContent = gesture.openness.toFixed(2);
    if (teleDepth) teleDepth.textContent = gesture.depth.toFixed(2);
  }
}

function updateUIForGestureAndState(gesture) {
  if (!gesture) {
    setStatus('👋', 'No hand detected', 'Hold your palm in view of the webcam');
    updateTelemetryDisplay(null);
    return;
  }

  const flowerState = getFlowerState();
  switch (flowerState) {
    case 'IDLE':
      if (gesture.isPinching) {
        setStatus('✨', 'Spawning Seed...', 'Hold steady in palm');
      } else {
        setStatus('🤏', 'Ready to Plant', 'Pinch thumb & index finger together');
      }
      break;

    case 'SEED':
      setStatus('🌱', 'Seed Sprouted!', 'Open your hand slowly to grow the stem');
      break;

    case 'GROWING':
      setStatus('🌿', 'Stem Growing...', 'Open palm wide to bloom petals');
      break;

    case 'BLOOMED':
      setStatus('🌹', 'Rose Bloomed!', 'Curl fingers to close petals • Move hand to scale');
      break;

    default:
      setStatus('✨', 'Magic Rose AR', 'Tracking active');
      break;
  }

  updateTelemetryDisplay(gesture);
}

function setupControls() {
  // Toggle Guide
  function toggleGuide() {
    if (!guideCard) return;
    guideCard.classList.toggle('hidden');
    if (btnToggleGuide) {
      btnToggleGuide.classList.toggle('active', !guideCard.classList.contains('hidden'));
    }
  }

  btnToggleGuide?.addEventListener('click', toggleGuide);
  btnCloseGuide?.addEventListener('click', toggleGuide);

  // Toggle Landmark Debug Wireframe
  btnToggleDebug?.addEventListener('click', () => {
    const enabled = toggleDebugOverlay();
    if (btnToggleDebug) btnToggleDebug.classList.toggle('active', enabled);
    if (debugTelemetry) debugTelemetry.style.display = enabled ? 'flex' : 'none';
  });

  // Reset Flower
  btnReset?.addEventListener('click', () => {
    resetFlower(scene);
    setStatus('↺', 'Flower Reset', 'Pinch fingers to plant a new seed');
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'r') {
      resetFlower(scene);
      setStatus('↺', 'Flower Reset', 'Pinch fingers to plant a new seed');
    } else if (key === 'd') {
      const enabled = toggleDebugOverlay();
      if (btnToggleDebug) btnToggleDebug.classList.toggle('active', enabled);
      if (debugTelemetry) debugTelemetry.style.display = enabled ? 'flex' : 'none';
    } else if (key === 'h') {
      toggleGuide();
    }
  });
}

async function init() {
  initScene();

  // Clean initial state on fresh load
  resetFlower(scene);
  setupControls();

  setStatus('📷', 'Requesting Webcam...', 'Please allow camera access in your browser');

  try {
    const video = await initWebcam();
    initDebugOverlay(video);

    setStatus('🧠', 'Loading Neural Model...', 'Preparing MediaPipe hand landmark detector');
    await initHandTracker();

    setStatus('👋', 'Camera Ready!', 'Show your hand to the camera to begin');

    onHandResults((landmarks) => {
      drawLandmarks(landmarks);
      const gesture = analyzeGesture(landmarks);
      updateFlowerTarget(scene, gesture, landmarks, camera, video);
      updateUIForGestureAndState(gesture);
    });

    registerUpdate((delta) => tickFlower(delta));
    startDetection(video);
  } catch (err) {
    console.error('[Magic Rose] Error:', err);
    setStatus('⚠️', 'Error Initializing', err.message || 'Could not access webcam or models');
  }
}

init();
