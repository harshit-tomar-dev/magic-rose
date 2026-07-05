// src/flower/flowerController.js
// Orchestrates the flower lifecycle: pinch -> seed -> growing stem/leaves ->
// bloomed rose. Position AND scale are each smoothed independently every
// render frame, decoupled from MediaPipe's detection rate, for lag-free
// following and cinematic distance-based sizing.

import * as THREE from 'three';
import gsap from 'gsap';
import { spawnSeed, updateSeedPosition, removeSeed } from './seed.js';
import { createStem, updateStemGrowth, getStemTopLocalY, removeStem } from './stem.js';
import { createLeaves, updateLeaves, removeLeaves } from './leaves.js';
import { createRose, triggerBloom, updateRoseIdle, updateRoseOpenness, setGlowScale, removeRose } from './rose.js';
import { emitBurst } from '../effects/particles.js';
import { landmarkToWorld, getPalmCenter } from '../utils/coordMapper.js';

const STATES = { IDLE: 'IDLE', SEED: 'SEED', GROWING: 'GROWING', BLOOMED: 'BLOOMED' };

// --- Recalibrated gesture thresholds (fixes premature growth/bloom) ---
const OPEN_THRESHOLD_TO_GROW = 0.42;
const GROWTH_MAX_OPENNESS = 0.85;
const BLOOM_OPENNESS = 0.88;
const BLOOM_HOLD_MS = 300;
const CLOSE_MIN_OPENNESS = 0.35;
const HAND_LOST_TIMEOUT_MS = 1000;
const FOLLOW_LERP_SPEED = 9;

// --- Phase 9: distance-based scaling ---
const SCALE_MIN = 0.45;
const SCALE_MAX = 1.1;
const SCALE_LERP_SPEED = 6;
const BASE_PARTICLE_SIZE = 0.06;

let currentState = STATES.IDLE;
let flowerGroup = null;
let targetWorldPos = null;
let currentWorldPos = null;
let lastSparkleTime = 0;
let lastHandSeenTime = performance.now();
let isFadingOut = false;
let lastOpenness = 1;
let bloomHoldStart = null;

let targetScale = 1;
let currentScale = 1;

/** Called from the MediaPipe results callback. Updates targets + state transitions only. */
export function updateFlowerTarget(scene, gesture, landmarks, camera, video) {
  const now = performance.now();

  if (!landmarks) {
    if (flowerGroup && !isFadingOut && now - lastHandSeenTime > HAND_LOST_TIMEOUT_MS) {
      fadeOutAndReset(scene);
    }
    return;
  }
  lastHandSeenTime = now;
  if (!gesture || isFadingOut) return;
  lastOpenness = gesture.openness;

  const palm = getPalmCenter(landmarks);
  targetWorldPos = landmarkToWorld(palm.x, palm.y, camera, video);

// NEW: distance sets the overall size range, openness (0-1, already computed)
// blends the flower from "small/tucked in palm" toward "fully sized" as you open your hand.
const distanceScale = THREE.MathUtils.lerp(SCALE_MIN, SCALE_MAX, gesture.depth);
const opennessBlend = THREE.MathUtils.clamp(gesture.openness / GROWTH_MAX_OPENNESS, 0, 1);
targetScale = THREE.MathUtils.clamp(
  THREE.MathUtils.lerp(SCALE_MIN * 0.5, distanceScale, opennessBlend),
  SCALE_MIN * 0.5,
  SCALE_MAX
);

  // --- IDLE -> SEED ---
  if (currentState === STATES.IDLE && gesture.isPinching) {
    currentWorldPos = { ...targetWorldPos };
    currentScale = targetScale;

    flowerGroup = new THREE.Group();
    flowerGroup.position.set(currentWorldPos.x, currentWorldPos.y, currentWorldPos.z);
    flowerGroup.scale.setScalar(currentScale);
    scene.add(flowerGroup);

    spawnSeed(flowerGroup, { x: 0, y: 0, z: 0 });
    emitBurst(scene, currentWorldPos, { count: 50, color: 0xffe89a, size: BASE_PARTICLE_SIZE * currentScale });

    currentState = STATES.SEED;
    return;
  }

  if (!flowerGroup) return;

  // --- SEED -> GROWING ---
  if (currentState === STATES.SEED && gesture.openness > OPEN_THRESHOLD_TO_GROW) {
    createStem(flowerGroup);
    createLeaves(flowerGroup);
    currentState = STATES.GROWING;
  }

  // --- GROWING ---
  if (currentState === STATES.GROWING) {
    const growth = mapRange(gesture.openness, OPEN_THRESHOLD_TO_GROW, GROWTH_MAX_OPENNESS, 0, 1);
    updateStemGrowth(growth);
    updateSeedPosition({ x: 0, y: getStemTopLocalY(), z: 0 });
    updateLeaves(growth);

    const now2 = performance.now();
    if (now2 - lastSparkleTime > 300) {
      lastSparkleTime = now2;
      const tipWorld = new THREE.Vector3(0, getStemTopLocalY(), 0);
      flowerGroup.localToWorld(tipWorld);
      emitBurst(scene, tipWorld, {
        count: 6,
        color: 0x9dffb0,
        spread: 0.15,
        duration: 0.6,
        size: BASE_PARTICLE_SIZE * currentScale,
      });
    }

    // --- GROWING -> BLOOMED ---
    if (gesture.openness > BLOOM_OPENNESS) {
      if (bloomHoldStart === null) bloomHoldStart = now2;

      if (now2 - bloomHoldStart >= BLOOM_HOLD_MS) {
        removeSeed(flowerGroup);
        createRose(flowerGroup, getStemTopLocalY());
        triggerBloom();

        const bloomWorld = new THREE.Vector3(0, getStemTopLocalY(), 0);
        flowerGroup.localToWorld(bloomWorld);
        emitBurst(scene, bloomWorld, {
          count: 80,
          color: 0xffb6c9,
          spread: 0.5,
          duration: 1.5,
          size: BASE_PARTICLE_SIZE * currentScale,
        });

        currentState = STATES.BLOOMED;
        bloomHoldStart = null;
      }
    } else {
      bloomHoldStart = null;
    }
  }
}

/** Called every render frame (60fps). Position and scale are smoothed INDEPENDENTLY. */
export function tickFlower(delta) {
  if (flowerGroup && !isFadingOut) {
    if (currentWorldPos && targetWorldPos) {
      const posAlpha = 1 - Math.exp(-FOLLOW_LERP_SPEED * delta);
      currentWorldPos.x += (targetWorldPos.x - currentWorldPos.x) * posAlpha;
      currentWorldPos.y += (targetWorldPos.y - currentWorldPos.y) * posAlpha;
      currentWorldPos.z += (targetWorldPos.z - currentWorldPos.z) * posAlpha;
      flowerGroup.position.set(currentWorldPos.x, currentWorldPos.y, currentWorldPos.z);
    }

    const scaleAlpha = 1 - Math.exp(-SCALE_LERP_SPEED * delta);
    currentScale += (targetScale - currentScale) * scaleAlpha;
    flowerGroup.scale.setScalar(currentScale);

    if (currentState === STATES.BLOOMED) {
      setGlowScale(currentScale / SCALE_MAX);
    }
  }

  if (currentState === STATES.BLOOMED) {
    updateRoseIdle(performance.now() / 1000);
    const openAmount = mapRange(lastOpenness, CLOSE_MIN_OPENNESS, BLOOM_OPENNESS, 0, 1);
    updateRoseOpenness(openAmount);
  }
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

function fadeOutAndReset(scene) {
  if (!flowerGroup) return;
  isFadingOut = true;
  const group = flowerGroup;

  gsap.to(group.scale, {
    x: 0.001, y: 0.001, z: 0.001,
    duration: 0.4,
    ease: 'power2.in',
    onComplete: () => {
      removeRose(group);
      removeLeaves(group);
      removeStem(group);
      removeSeed(group);
      scene.remove(group);
      if (flowerGroup === group) flowerGroup = null;
      currentState = STATES.IDLE;
      currentWorldPos = null;
      targetWorldPos = null;
      isFadingOut = false;
      currentScale = 1;
      targetScale = 1;
    },
  });
}

export function resetFlower(scene) {
  if (flowerGroup) {
    gsap.killTweensOf(flowerGroup.scale);
    removeRose(flowerGroup);
    removeLeaves(flowerGroup);
    removeStem(flowerGroup);
    removeSeed(flowerGroup);
    scene.remove(flowerGroup);
    flowerGroup = null;
  }
  currentState = STATES.IDLE;
  currentWorldPos = null;
  targetWorldPos = null;
  isFadingOut = false;
  lastOpenness = 1;
  bloomHoldStart = null;
  currentScale = 1;
  targetScale = 1;
}

export function getFlowerState() {
  return currentState;
}