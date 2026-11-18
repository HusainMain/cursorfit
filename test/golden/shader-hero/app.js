import * as THREE from 'three';

const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.z = 6;

const geometry = new THREE.IcosahedronGeometry(2, 24);
const material = new THREE.MeshStandardMaterial({ color: 0x2b6cff, roughness: 0.35 });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

scene.add(new THREE.HemisphereLight(0xffffff, 0x111122, 1.4));

function tick(now) {
  mesh.rotation.y = now * 0.0002;
  mesh.rotation.x = Math.sin(now * 0.0003) * 0.2;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
