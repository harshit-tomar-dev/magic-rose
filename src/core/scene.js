// src/core/scene.js
// Core Three.js setup: scene, camera, renderer, lighting, resize, and the
// central animation loop. AR mode: renderer is transparent so the live
// webcam feed (CSS layer behind the canvas) shows through.

import * as THREE from 'three';

let scene, camera, renderer;
let clock;
const updateCallbacks = [];

export function initScene() {
  const container = document.getElementById('scene-container');

  // --- Scene ---
  scene = new THREE.Scene();
  // NOTE: no scene.background set — leaving it null lets the transparent
  // renderer show the webcam feed underneath instead of a solid color.

  // --- Camera ---
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.5, 6);
  camera.lookAt(0, 1, 0);

  // --- Renderer (alpha enabled for AR compositing) ---
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // fully transparent clear color

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  container.appendChild(renderer.domElement);

  setupLights();

  // NOTE: ground plane removed — a solid shadow-catching disc looks wrong
  // floating over a live webcam feed. Shadows still work on 3D objects
  // themselves (e.g. leaves casting onto the stem) without it.

  window.addEventListener('resize', onWindowResize);

  clock = new THREE.Clock();
  renderer.setAnimationLoop(animate);

  return { scene, camera, renderer };
}

function setupLights() {
  const keyLight = new THREE.DirectionalLight(0xfff2e0, 2.2);
  keyLight.position.set(3, 5, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 20;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const ambient = new THREE.AmbientLight(0x404060, 0.8); // slightly brighter, no ground to bounce light off
  scene.add(ambient);

  const rimLight = new THREE.PointLight(0x9d7bff, 1.5, 10);
  rimLight.position.set(-3, 2, -3);
  scene.add(rimLight);
}

export function registerUpdate(callback) {
  updateCallbacks.push(callback);
}

function animate() {
  const delta = clock.getDelta();
  updateCallbacks.forEach((cb) => cb(delta));
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export { scene, camera, renderer };