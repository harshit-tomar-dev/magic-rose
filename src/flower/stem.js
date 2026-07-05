// src/flower/stem.js
// Creates and grows the stem in real time, driven by hand-openness.

import * as THREE from 'three';

let stemMesh = null;
const MAX_STEM_HEIGHT = 1.6; // full height once hand is fully open

/**
 * Creates the stem mesh as a child of the given parent (the flowerGroup).
 * Starts at near-zero scale; growth is applied via updateStemGrowth().
 */
export function createStem(parent) {
  if (stemMesh) return stemMesh;

  const geometry = new THREE.CylinderGeometry(0.02, 0.035, MAX_STEM_HEIGHT, 12, 1, false);
  // Shift geometry up so the base sits at local y=0 (pivot at bottom, not center).
  // This means scaling on Y grows the stem upward from a fixed base point.
  geometry.translate(0, MAX_STEM_HEIGHT / 2, 0);

  const material = new THREE.MeshStandardMaterial({
    color: 0x2f6d34,
    roughness: 0.6,
    metalness: 0.05,
  });

  stemMesh = new THREE.Mesh(geometry, material);
  stemMesh.castShadow = true;
  stemMesh.receiveShadow = true;
  stemMesh.scale.y = 0.001; // start invisible
  parent.add(stemMesh);

  return stemMesh;
}

/**
 * Sets stem height based on normalized growth (0-1).
 * Uses scale instead of rebuilding geometry — much cheaper per frame.
 */
export function updateStemGrowth(growth) {
  if (!stemMesh) return;
  stemMesh.scale.y = Math.max(0.001, Math.min(1, growth));
}

/** Returns the current top-of-stem position in the parent's local space. */
export function getStemTopLocalY() {
  if (!stemMesh) return 0;
  return MAX_STEM_HEIGHT * stemMesh.scale.y;
}

export function removeStem(parent) {
  if (!stemMesh) return;
  parent.remove(stemMesh);
  stemMesh.geometry.dispose();
  stemMesh.material.dispose();
  stemMesh = null;
}

export function getStem() {
  return stemMesh;
}