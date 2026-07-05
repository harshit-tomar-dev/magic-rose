// src/flower/rose.js
// Creates a full, layered rose bloom: 3 rings of petals (inner tight bud,
// mid, outer wide) that unfurl in sequence into an open, realistic-looking flower.

import * as THREE from 'three';
import gsap from 'gsap';

let roseGroup = null;
let petalMeshes = [];
let coreLight = null;

/** Rounded, cupped rose-petal outline — wide rounded top, tapered base. */
function createPetalShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.02, 0.05, 0.24, 0.16, 0.26, 0.34);
  shape.bezierCurveTo(0.28, 0.5, 0.14, 0.58, 0, 0.6);
  shape.bezierCurveTo(-0.14, 0.58, -0.28, 0.5, -0.26, 0.34);
  shape.bezierCurveTo(-0.24, 0.16, -0.02, 0.05, 0, 0);
  return shape;
}

function createPetalMesh(color) {
  const shape = createPetalShape();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 12,
  });
  // Pivot stays at the base (0,0) so petals rotate open from their attachment point.

  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0, // ramped up during bloom, settles to a soft glow after
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.setScalar(0.001);
  return mesh;
}

/**
 * Builds the closed rose bud as a child of `parent`, at local height `localY`
 * (the top of the stem). Petals start folded upright and tiny (bud form).
 */
export function createRose(parent, localY) {
  roseGroup = new THREE.Group();
  roseGroup.position.set(0, localY, 0);
  parent.add(roseGroup);
  petalMeshes = [];

  // 3 concentric rings: inner (tight, upright) -> mid -> outer (wide open)
  const layers = [
    { count: 5, radius: 0.015, color: 0xb5285a, openAngleX: -1.0, scale: 0.55, tiltZ: 0 },
    { count: 6, radius: 0.03, color: 0xd13d70, openAngleX: -0.3, scale: 0.85, tiltZ: 0.05 },
    { count: 8, radius: 0.05, color: 0xe85a8a, openAngleX: 0.5, scale: 1.15, tiltZ: 0.1 },
  ];

  layers.forEach((layer, layerIdx) => {
    for (let i = 0; i < layer.count; i++) {
      const petal = createPetalMesh(layer.color);
      const angle = (i / layer.count) * Math.PI * 2 + layerIdx * 0.35;

      petal.position.set(
        Math.cos(angle) * layer.radius,
        0,
        Math.sin(angle) * layer.radius
      );
      petal.rotation.y = -angle + Math.PI / 2;
      petal.rotation.z = layer.tiltZ;
      petal.rotation.x = -1.4; // start closed, upright, like a tight bud

      petal.userData.openAngleX = layer.openAngleX;
      petal.userData.closedAngleX = -1.4; // tight bud angle, matches initial pose
      petal.userData.finalScale = layer.scale;

      roseGroup.add(petal);
      petalMeshes.push({ mesh: petal, layerIdx, i });
    }
  });

  // Warm glowing core, feeds bloom post-processing later (Phase 10)
  coreLight = new THREE.PointLight(0xff7a9c, 2.2, 1.4);
  coreLight.position.set(0, 0.1, 0);
  roseGroup.add(coreLight);

  roseGroup.scale.setScalar(0.001); // whole rose invisible until bloom triggers
}

let bloomSettled = false;

/**
 * Plays the bloom: whole rose scales up fast, each ring unfurls in quick
 * succession (outer trailing inner only slightly), and the petal glow
 * intensifies as it opens. Tuned to read as fast, smooth and magical —
 * total bloom time is well under a second instead of the previous ~2s.
 */
export function triggerBloom() {
  if (!roseGroup) return;
  bloomSettled = false;

  gsap.to(roseGroup.scale, {
    x: 1, y: 1, z: 1,
    duration: 0.45,
    ease: 'back.out(1.6)',
  });

  if (coreLight) {
    gsap.fromTo(coreLight, { intensity: 0.4 }, { intensity: 2.6, duration: 0.5, ease: 'sine.out' });
  }

  let maxDelay = 0;
  petalMeshes.forEach(({ mesh, layerIdx, i }) => {
    const delay = layerIdx * 0.1 + i * 0.018;
    maxDelay = Math.max(maxDelay, delay);
    const duration = 0.5;

    // Petal opening: scale + rotation together for a lively "pop"
    gsap.to(mesh.rotation, {
      x: mesh.userData.openAngleX,
      z: mesh.rotation.z, // keep existing tilt, only animate the opening axis
      duration,
      delay,
      ease: 'power2.out',
    });
    gsap.to(mesh.scale, {
      x: mesh.userData.finalScale,
      y: mesh.userData.finalScale,
      z: mesh.userData.finalScale,
      duration,
      delay,
      ease: 'back.out(1.6)',
    });

    // Glow intensifies as each petal opens, then settles to a soft ambient glow
    gsap.to(mesh.material, {
      emissiveIntensity: 0.5,
      duration: duration * 0.8,
      delay,
      ease: 'sine.out',
      onComplete: () => {
        gsap.to(mesh.material, { emissiveIntensity: 0.15, duration: 0.6, ease: 'sine.inOut' });
      },
    });
  });

  gsap.delayedCall(maxDelay + 0.5, () => {
    bloomSettled = true;
    if (coreLight) gsap.to(coreLight, { intensity: 1.4, duration: 0.6, ease: 'sine.inOut' });
  });
}

/**
 * Continuously drives how open the bloomed rose looks (0 = gently closed,
 * 1 = fully open), based on live hand openness. Only takes effect once the
 * initial bloom animation has settled, so it never fights the bloom tween.
 * Uses a per-frame damped lerp (no gsap) so it can be called every frame safely.
 */
export function updateRoseOpenness(amount, dampingFactor = 0.08) {
  if (!roseGroup || !bloomSettled) return;
  const clamped = Math.max(0, Math.min(1, amount));

  petalMeshes.forEach(({ mesh }) => {
    const target = THREE.MathUtils.lerp(
      mesh.userData.closedAngleX,
      mesh.userData.openAngleX,
      clamped
    );
    mesh.rotation.x += (target - mesh.rotation.x) * dampingFactor;
  });

  if (coreLight) {
    const targetIntensity = THREE.MathUtils.lerp(0.6, 1.4, clamped);
    coreLight.intensity += (targetIntensity - coreLight.intensity) * dampingFactor;
  }
}
/**
 * Scales the bloomed rose's glow intensity based on the flower's overall
 * distance-based scale (Phase 9). Only applies once the initial bloom
 * animation has settled, so it never fights the bloom-in GSAP tween or
 * the openness-driven glow in updateRoseOpenness — it multiplies whatever
 * intensity those already produced, rather than overwriting it outright.
 */
export function setGlowScale(multiplier) {
  if (!roseGroup || !coreLight || !bloomSettled) return;
  const clamped = THREE.MathUtils.clamp(multiplier, 0.4, 1.2);
  coreLight.intensity = coreLight.intensity * 0.85 + (1.4 * clamped) * 0.15;
}

/** Gentle idle sway once bloomed. */
export function updateRoseIdle(time) {
  if (!roseGroup) return;
  roseGroup.rotation.y = Math.sin(time * 0.4) * 0.05;
}

export function removeRose(parent) {
  if (!roseGroup) return;
  petalMeshes.forEach(({ mesh }) => {
    gsap.killTweensOf(mesh.rotation);
    gsap.killTweensOf(mesh.scale);
    gsap.killTweensOf(mesh.material);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  gsap.killTweensOf(roseGroup.scale);
  if (coreLight) gsap.killTweensOf(coreLight);
  parent.remove(roseGroup);
  roseGroup = null;
  petalMeshes = [];
  coreLight = null;
  bloomSettled = false;
}