// src/flower/leaves.js
// Creates realistic, symmetric leaf shapes along the stem, revealing them
// one after another, and keeping their height in sync with the stem's
// CURRENT growth level (not a fixed final height) so they never float
// disconnected if the hand closes and the stem shrinks back down.

import * as THREE from 'three';
import gsap from 'gsap';

const LEAF_LEVELS = [0.35, 0.6, 0.82];
const MAX_STEM_HEIGHT = 1.6; // must match stem.js
const REVEAL_STAGGER = 0.35;
const LEAF_LENGTH = 0.4;
const LEAF_WIDTH = 0.14;

let leafGroup = null;
let leafPairs = [];

function createLeafShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(LEAF_WIDTH * 1.05, LEAF_LENGTH * 0.22, LEAF_WIDTH * 0.62, LEAF_LENGTH * 0.55);
  shape.quadraticCurveTo(LEAF_WIDTH * 0.28, LEAF_LENGTH * 0.88, 0, LEAF_LENGTH);
  shape.quadraticCurveTo(-LEAF_WIDTH * 0.28, LEAF_LENGTH * 0.88, -LEAF_WIDTH * 0.62, LEAF_LENGTH * 0.55);
  shape.quadraticCurveTo(-LEAF_WIDTH * 1.05, LEAF_LENGTH * 0.22, 0, 0);
  return shape;
}

function createLeafMesh() {
  const shape = createLeafShape();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, 0);

  const material = new THREE.MeshStandardMaterial({
    color: 0x357a3d,
    roughness: 0.55,
    metalness: 0.02,
    side: THREE.DoubleSide,
    emissive: 0x0f2a12,
    emissiveIntensity: 0.35,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.setScalar(0.001);
  return mesh;
}

export function createLeaves(parent) {
  leafGroup = new THREE.Group();
  parent.add(leafGroup);

  leafPairs = LEAF_LEVELS.map((level, idx) => {
    const left = createLeafMesh();
    const right = createLeafMesh();

    // Start at y=0 — actual height is set every frame in updateLeaves()
    // based on current growth, never a fixed value.
    left.position.set(0, 0, 0);
    right.position.set(0, 0, 0);

    const baseTilt = -0.35;
    const twist = idx * 0.9;
    left.userData.restRotation = { x: baseTilt, y: twist, z: 0.25 };
    right.userData.restRotation = { x: baseTilt, y: twist + Math.PI, z: -0.25 };

    left.rotation.set(baseTilt, twist, Math.PI / 2 * -1);
    right.rotation.set(baseTilt, twist + Math.PI, Math.PI / 2);

    leafGroup.add(left, right);
    return { level, revealed: false, meshes: [left, right] };
  });
}

/**
 * Called every frame during GROWING with current growth (0-1).
 * IMPORTANT FIX: repositions every leaf's height to `level * MAX_STEM_HEIGHT * growth`
 * EVERY frame (not just once on reveal) — so leaves stay attached to the stem's
 * actual current height, sliding back down with it if the hand closes again,
 * instead of freezing at whatever height they first revealed at.
 */
export function updateLeaves(growth) {
  if (!leafGroup) return;

  leafPairs.forEach((pair, idx) => {
    // Keep height in sync with the stem's real current growth, always.
    const y = pair.level * MAX_STEM_HEIGHT * growth;
    pair.meshes.forEach((mesh) => mesh.position.setY(y));

    if (!pair.revealed && growth >= pair.level) {
      pair.revealed = true;
      const delay = idx * REVEAL_STAGGER;

      pair.meshes.forEach((mesh) => {
        const rest = mesh.userData.restRotation;
        gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.8, delay, ease: 'back.out(1.4)' });
        gsap.to(mesh.rotation, {
          x: rest.x, y: rest.y, z: rest.z, duration: 0.9, delay, ease: 'power2.out',
          onComplete: () => startIdleSway(mesh, rest),
        });
      });
    }
  });
}

function startIdleSway(mesh, rest) {
  const swayAmount = 0.045 + Math.random() * 0.03;
  const duration = 1.8 + Math.random() * 1.0;
  gsap.to(mesh.rotation, {
    z: rest.z + (rest.z >= 0 ? -swayAmount : swayAmount),
    duration,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    delay: Math.random() * 0.5,
  });
}

export function removeLeaves(parent) {
  if (!leafGroup) return;
  leafPairs.forEach((pair) => {
    pair.meshes.forEach((mesh) => {
      gsap.killTweensOf(mesh.scale);
      gsap.killTweensOf(mesh.rotation);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
  });
  parent.remove(leafGroup);
  leafGroup = null;
  leafPairs = [];
}

export function hasLeaves() {
  return leafGroup !== null;
}