// src/flower/seed.js
// Creates and animates the magical glowing seed/bud.
// Lives as a child of the flowerGroup — position is local to that group.

import * as THREE from 'three';
import gsap from 'gsap';

let seedMesh = null;

/** Spawns the seed as a child of `parent` (scene or flowerGroup) at a local position. */
export function spawnSeed(parent, localPosition) {
  if (seedMesh) return seedMesh;

  const geometry = new THREE.SphereGeometry(0.08, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0xfff2b0,
    emissive: 0xffd76a,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.1,
  });

  seedMesh = new THREE.Mesh(geometry, material);
  seedMesh.position.set(localPosition.x, localPosition.y, localPosition.z);
  seedMesh.scale.setScalar(0.001);
  seedMesh.castShadow = true;
  parent.add(seedMesh);

  const glow = new THREE.PointLight(0xffd76a, 2, 1.5);
  glow.name = 'seed-glow';
  seedMesh.add(glow);

  gsap.timeline()
    .to(seedMesh.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(2)' })
    .to(seedMesh.scale, {
      x: 1.15, y: 1.15, z: 1.15,
      duration: 0.8, ease: 'sine.inOut', yoyo: true, repeat: -1,
    });

  return seedMesh;
}

/** Moves the seed to a new LOCAL position (e.g. riding the top of the growing stem). */
export function updateSeedPosition(localPosition) {
  if (!seedMesh) return;
  seedMesh.position.set(localPosition.x, localPosition.y, localPosition.z);
}

export function removeSeed(parent) {
  if (!seedMesh) return;
  gsap.killTweensOf(seedMesh.scale);
  parent.remove(seedMesh);
  seedMesh.geometry.dispose();
  seedMesh.material.dispose();
  seedMesh = null;
}

export function getSeed() {
  return seedMesh;
}