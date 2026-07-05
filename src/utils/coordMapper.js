// src/utils/coordMapper.js
// Converts hand landmark positions into precise Three.js world coordinates
// by raycasting from the camera through the landmark's real on-screen pixel
// position (accounting for object-fit:cover cropping + mirroring) onto a
// fixed depth plane. This guarantees 3D content aligns exactly with where
// the hand visually appears in the webcam feed.

import * as THREE from 'three';
import { videoNormToScreen } from './videoCoverMapper.js';

const raycaster = new THREE.Raycaster();
const depthPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // world z = 0
const tempVec3 = new THREE.Vector3();

/**
 * Computes palm center using ONLY the four knuckle (MCP) landmarks — 5, 9, 13, 17.
 * Wrist (0) is deliberately excluded so the anchor sits naturally in the palm.
 */
export function getPalmCenter(landmarks) {
  const indices = [5, 9, 13, 17];
  let x = 0, y = 0;
  indices.forEach((i) => {
    x += landmarks[i].x;
    y += landmarks[i].y;
  });
  return { x: x / indices.length, y: y / indices.length };
}

/**
 * Converts a normalized landmark point into a Three.js world position by:
 *  1. Mapping it to real screen pixels (cover-crop + mirror aware)
 *  2. Converting screen pixels to normalized device coordinates (-1 to 1)
 *  3. Raycasting from the camera through that point onto a fixed z=0 plane
 *
 * @param {number} x - normalized 0-1
 * @param {number} y - normalized 0-1
 * @param {THREE.Camera} camera
 * @param {HTMLVideoElement} video
 * @returns {{x:number,y:number,z:number}}
 */
export function landmarkToWorld(x, y, camera, video) {
  if (!video || !video.videoWidth) return { x: 0, y: 1, z: 0 };

  const screenPos = videoNormToScreen(
    x, y,
    video.videoWidth, video.videoHeight,
    window.innerWidth, window.innerHeight
  );

  const ndcX = (screenPos.x / window.innerWidth) * 2 - 1;
  const ndcY = -(screenPos.y / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
  raycaster.ray.intersectPlane(depthPlane, tempVec3);

  return { x: tempVec3.x, y: tempVec3.y, z: tempVec3.z };
}

/** Exponential smoothing (lerp) toward a target position, removing per-frame jitter. */
export function smoothPosition(current, target, alpha = 0.25) {
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
}