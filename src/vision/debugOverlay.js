// src/vision/debugOverlay.js
// Draws hand landmarks directly on top of the user's hand in the full-screen
// webcam view. Uses videoNormToScreen so dots align with the real, displayed
// (cropped + mirrored) video — not raw normalized coordinates.

import { videoNormToScreen } from '../utils/videoCoverMapper.js';

const canvas = document.getElementById('debug-canvas');
const ctx = canvas.getContext('2d');
let debugEnabled = false;
let videoRef = null;

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

/** Initializes the full-screen debug canvas. Visible by default — disable via ?debug=0 in the URL. */
export function initDebugOverlay(video) {
  videoRef = video;
  const params = new URLSearchParams(window.location.search);
  debugEnabled = params.get('debug') !== '0';

  canvas.style.display = debugEnabled ? 'block' : 'none';
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

/** Toggles debug landmark mesh display on the fly. */
export function toggleDebugOverlay() {
  debugEnabled = !debugEnabled;
  canvas.style.display = debugEnabled ? 'block' : 'none';
  if (!debugEnabled) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  return debugEnabled;
}

export function isDebugEnabled() {
  return debugEnabled;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/** Draws landmarks exactly on the hand, using the same cover-mapping as the video display. */
export function drawLandmarks(landmarks) {
  if (!debugEnabled) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks || !videoRef || !videoRef.videoWidth) return;

  const toScreen = (p) =>
    videoNormToScreen(
      p.x, p.y,
      videoRef.videoWidth, videoRef.videoHeight,
      canvas.width, canvas.height
    );

  ctx.save();
  ctx.shadowColor = '#9d7bff';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = 'rgba(157, 123, 255, 0.9)';
  ctx.lineWidth = 3;
  HAND_CONNECTIONS.forEach(([a, b]) => {
    const p1 = toScreen(landmarks[a]);
    const p2 = toScreen(landmarks[b]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });

  ctx.shadowBlur = 14;
  ctx.fillStyle = '#d9baff';
  landmarks.forEach((p) => {
    const sp = toScreen(p);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
