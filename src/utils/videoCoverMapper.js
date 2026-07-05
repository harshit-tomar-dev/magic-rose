// src/utils/videoCoverMapper.js
// Shared math for mapping normalized MediaPipe landmark coordinates (0-1)
// to actual on-screen pixel positions, accounting for the webcam being
// displayed with CSS `object-fit: cover` (which crops the video to fill
// the window — raw normalized coords do NOT map 1:1 to screen pixels
// unless the video's aspect ratio exactly matches the screen's).

/**
 * @param {number} x - normalized landmark x (0-1), raw/unmirrored video space
 * @param {number} y - normalized landmark y (0-1)
 * @param {number} videoWidth - video.videoWidth (intrinsic camera pixels)
 * @param {number} videoHeight - video.videoHeight
 * @param {number} screenWidth - window.innerWidth
 * @param {number} screenHeight - window.innerHeight
 * @param {'contain'|'cover'} fit - must match the CSS object-fit used on #webcam.
 *   'contain' (default) shows the entire camera frame letterboxed — this is
 *   what fixes the "too zoomed in" framing issue. 'cover' is kept for
 *   reference/fallback in case the CSS framing is ever switched back.
 * @returns {{x: number, y: number}} pixel position on screen (mirrored to match the visual mirror)
 */
export function videoNormToScreen(x, y, videoWidth, videoHeight, screenWidth, screenHeight, fit = 'contain') {
  const videoAspect = videoWidth / videoHeight;
  const screenAspect = screenWidth / screenHeight;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (fit === 'cover') {
    if (videoAspect > screenAspect) {
      // Video is relatively wider than the screen -> full height, sides cropped
      drawHeight = screenHeight;
      drawWidth = screenHeight * videoAspect;
      offsetX = (drawWidth - screenWidth) / 2;
      offsetY = 0;
    } else {
      // Video is relatively taller -> full width, top/bottom cropped
      drawWidth = screenWidth;
      drawHeight = screenWidth / videoAspect;
      offsetX = 0;
      offsetY = (drawHeight - screenHeight) / 2;
    }

    const rawPx = x * drawWidth;
    const rawPy = y * drawHeight;
    const screenX = rawPx - offsetX;
    const screenY = rawPy - offsetY;
    return { x: screenWidth - screenX, y: screenY };
  }

  // --- contain: entire video visible, letterboxed (matches CSS object-fit: contain) ---
  if (videoAspect > screenAspect) {
    // Video relatively wider -> fits full width, letterbox bars top/bottom
    drawWidth = screenWidth;
    drawHeight = screenWidth / videoAspect;
    offsetX = 0;
    offsetY = (screenHeight - drawHeight) / 2;
  } else {
    // Video relatively taller -> fits full height, letterbox bars left/right
    drawHeight = screenHeight;
    drawWidth = screenHeight * videoAspect;
    offsetX = (screenWidth - drawWidth) / 2;
    offsetY = 0;
  }

  const rawPx = x * drawWidth;
  const rawPy = y * drawHeight;
  const screenX = offsetX + rawPx;
  const screenY = offsetY + rawPy;

  // Mirror X across the full screen width to match the CSS scaleX(-1) mirror
  // applied to the (full-viewport-sized) webcam element.
  const mirroredScreenX = screenWidth - screenX;

  return { x: mirroredScreenX, y: screenY };
}