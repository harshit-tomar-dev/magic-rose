// src/vision/webcam.js
// Handles webcam permission requests and video stream setup.

const video = document.getElementById('webcam');

export async function initWebcam() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not supported in this browser.');
  }

  // Request a widescreen resolution so CSS object-fit:cover has minimal
  // cropping to do against a typical 16:9 screen — this fixes the
  // "zoomed in too much" look caused by cropping a 4:3 feed heavily.
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      aspectRatio: { ideal: 16 / 9 },
      facingMode: 'user',
    },
    audio: false,
  });

  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });

  return video;
}

export { video };