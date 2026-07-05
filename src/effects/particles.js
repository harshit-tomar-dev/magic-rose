// src/effects/particles.js
// Reusable magical particle burst system, built with THREE.Points for performance.

import * as THREE from 'three';
import gsap from 'gsap';

/**
 * Emits a one-shot particle burst at the given position.
 * @param {THREE.Scene} scene
 * @param {{x:number,y:number,z:number}} position
 * @param {object} options - { count, color, spread, duration, size }
 */
export function emitBurst(scene, position, options = {}) {
  const {
    count = 40,
    color = 0xffd76a,
    spread = 0.6,
    duration = 1.2,
    size = 0.06, // NEW: configurable, so flowerController can scale particles with flower size
  } = options;

  const positions = new Float32Array(count * 3);
  const velocities = [];

  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    velocities.push({
      x: Math.sin(phi) * Math.cos(theta) * spread,
      y: Math.sin(phi) * Math.sin(theta) * spread + 0.3,
      z: Math.cos(phi) * spread,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    size, // now uses the passed-in value instead of a hardcoded constant
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const progress = { t: 0 };
  const posAttr = geometry.attributes.position;

  gsap.to(progress, {
    t: 1,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      for (let i = 0; i < count; i++) {
        posAttr.array[i * 3] = position.x + velocities[i].x * progress.t;
        posAttr.array[i * 3 + 1] =
          position.y + velocities[i].y * progress.t - 0.4 * progress.t * progress.t;
        posAttr.array[i * 3 + 2] = position.z + velocities[i].z * progress.t;
      }
      posAttr.needsUpdate = true;
    },
    onComplete: () => {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  });

  gsap.to(material, {
    opacity: 0,
    duration,
    ease: 'power1.in',
  });
}