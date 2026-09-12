import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const VERTEX_SHADER = `
  attribute float aOpacity;
  attribute float aIndex;
  attribute float aEdge;
  attribute vec3 aScattered;

  uniform float uTime;
  uniform float uWaveSpeed;
  uniform float uWaveAmount;
  uniform vec2 uMouse;
  uniform float uMouseRadius;
  uniform float uMouseStrength;
  uniform float uMouseDistort;
  uniform float uAssembly;
  uniform float uLoose;
  uniform float uScatter;
  uniform vec3 uLightPos;
  uniform float uLightRange;
  uniform float uShadeMin;
  uniform float uShadeMax;

  varying float vOpacity;
  varying vec3 vWorldPos;
  varying float vAssembly;
  varying float vLight;

  void main() {
    vOpacity = aOpacity;
    vAssembly = uAssembly;

    vec3 targetCenter = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 localOffset = (instanceMatrix * vec4(position, 1.0)).xyz - targetCenter;
    vec3 scatteredCenter = aScattered;

    float assembly = smoothstep(0.0, 1.0, uAssembly);
    vec3 center = mix(scatteredCenter, targetCenter, assembly);
    vec3 pos = center + localOffset;
    vWorldPos = center;

    float loose = uLoose * mix(0.25, 1.0, aEdge) * assembly;
    if (loose > 0.001) {
      vec3 jitter = vec3(
        fract(sin(aIndex * 12.9898) * 43758.5453) - 0.5,
        fract(sin(aIndex * 78.2330) * 12543.1230) - 0.5,
        fract(sin(aIndex * 39.4250) * 26711.7700) - 0.5
      );
      pos += jitter * 0.05 * loose;
      pos.x += sin(uTime * 0.50 + aIndex * 0.53) * 0.06 * loose;
      pos.y += cos(uTime * 0.42 + aIndex * 0.71) * 0.06 * loose;
      pos.z += sin(uTime * 0.36 + aIndex * 0.91) * 0.08 * loose;

      float tail = smoothstep(-1.0, 3.0, targetCenter.x) * uLoose * assembly;
      pos.y += sin(uTime * 1.2 - targetCenter.x * 0.6) * 0.12 * tail;
      pos.z += cos(uTime * 1.0 - targetCenter.x * 0.45) * 0.08 * tail;
    }

    if (assembly > 0.95) {
      float effectStrength = (assembly - 0.95) * 20.0;
      float dist = length(center.xy);
      float waveFade = smoothstep(0.0, 3.0, dist);
      float wave = sin(dist * 3.0 - uTime * uWaveSpeed) * uWaveAmount * effectStrength * waveFade;
      pos.z += wave;
    }

    if (assembly > 0.8) {
      float mouseEffect = (assembly - 0.8) * 5.0;
      vec2 toMouse = center.xy - uMouse;
      float mouseDist = length(toMouse);

      if (mouseDist < uMouseRadius && mouseDist > 0.001) {
        float t = 1.0 - mouseDist / uMouseRadius;
        float force = t * t * t * mouseEffect * uMouseStrength;
        vec2 radialDir = toMouse / mouseDist;
        float noiseAngle = sin(aIndex * 0.37 + uTime * 0.5) * uMouseDistort;
        float ca = cos(noiseAngle);
        float sa = sin(noiseAngle);
        vec2 pushDir = vec2(radialDir.x * ca - radialDir.y * sa, radialDir.x * sa + radialDir.y * ca);

        pos.xy += pushDir * force * 1.8;
        pos.z += sin(aIndex * 1.7 + uTime) * force * 0.6;
      }
    }

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    float lightDist = distance(worldPos.xyz, uLightPos);
    float lit = clamp(1.0 - lightDist / uLightRange, 0.0, 1.0);
    vLight = mix(uShadeMin, uShadeMax, lit * lit);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  varying float vOpacity;
  varying vec3 vWorldPos;
  varying float vAssembly;
  varying float vLight;

  uniform float uTime;
  uniform vec3 uColor;

  void main() {
    float dist = length(vWorldPos.xy);
    float glow = smoothstep(8.0, 0.0, dist) * 0.3 * vAssembly;

    float baseAlpha = mix(0.45, 0.85, vAssembly);
    float alpha = vOpacity * (baseAlpha + glow);
    float shimmer = sin(uTime * 1.5 + vWorldPos.x * 5.0 + vWorldPos.y * 3.0) * 0.12 + 0.88;
    alpha *= shimmer * min(vLight, 1.2);

    vec3 color = (uColor + glow * vec3(0.2, 0.4, 0.8)) * vLight;
    color = mix(color, color * vec3(1.1, 1.05, 0.95), clamp(vLight - 1.0, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
  }
`;

function samplePointsFromImage(img, density = 50) {
  const canvas = document.createElement('canvas');
  const w = density;
  const aspect = (img.naturalHeight || img.height || 18) / (img.naturalWidth || img.width || 24);
  const h = Math.round(w * aspect);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const positions = [];
  const opacities = [];
  const edges = [];
  const scattered = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const alpha = data[idx + 3] / 255;
      if (alpha > 0.18) {
        const px = ((x - w / 2) / (w / 2)) * 3.4;
        const py = -((y - h / 2) / (h / 2)) * 2.55;
        const pz = (Math.random() - 0.5) * 0.15;

        positions.push(px, py, pz);
        opacities.push(alpha);

        const isEdge =
          x === 0 || x === w - 1 || y === 0 || y === h - 1 ||
          data[idx - 4 + 3] < 50 || data[idx + 4 + 3] < 50;
        edges.push(isEdge ? 1.0 : 0.25);

        scattered.push(
          px * 2.5 + (Math.random() - 0.5) * 4.0,
          py * 2.5 + (Math.random() - 0.5) * 4.0,
          pz + (Math.random() - 0.5) * 5.0
        );
      }
    }
  }

  return {
    count: positions.length / 3,
    positions: new Float32Array(positions),
    opacities: new Float32Array(opacities),
    edges: new Float32Array(edges),
    scattered: new Float32Array(scattered),
  };
}

export default function HeroWhale3D({ className = '' }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 800;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.8);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const whaleGroup = new THREE.Group();
    scene.add(whaleGroup);

    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let startTime = performance.now();
    let animId;

    let shaderMat = null;
    let instancedMesh = null;

    const initMesh = (data) => {
      const boxGeo = new THREE.BoxGeometry(0.065, 0.065, 0.02);
      const indexArray = new Float32Array(data.count);
      for (let i = 0; i < data.count; i++) indexArray[i] = i;

      boxGeo.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(data.opacities, 1));
      boxGeo.setAttribute('aIndex', new THREE.InstancedBufferAttribute(indexArray, 1));
      boxGeo.setAttribute('aScattered', new THREE.InstancedBufferAttribute(data.scattered, 3));
      boxGeo.setAttribute('aEdge', new THREE.InstancedBufferAttribute(data.edges, 1));

      shaderMat = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uWaveSpeed: { value: 1.5 },
          uWaveAmount: { value: 0.08 },
          uLightPos: { value: new THREE.Vector3(4.5, 5.5, 3.0) },
          uLightRange: { value: 14.0 },
          uShadeMin: { value: 0.28 },
          uShadeMax: { value: 2.79 },
          uColor: { value: new THREE.Color(0.45, 0.72, 1.0) }, // Glowing Ice-Blue/Cyan
          uMouse: { value: new THREE.Vector2(0, 0) },
          uMouseRadius: { value: 2.0 },
          uMouseStrength: { value: 0.45 },
          uMouseDistort: { value: 0.8 },
          uAssembly: { value: 0 },
          uLoose: { value: 1.0 },
          uScatter: { value: 0 },
        },
      });

      instancedMesh = new THREE.InstancedMesh(boxGeo, shaderMat, data.count);
      const dummy = new THREE.Object3D();

      for (let i = 0; i < data.count; i++) {
        dummy.position.set(
          data.positions[i * 3],
          data.positions[i * 3 + 1],
          data.positions[i * 3 + 2]
        );
        const s = 0.8 + Math.random() * 0.4;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      whaleGroup.add(instancedMesh);
    };

    // Load SVG
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/images/hero-whale.svg';
    img.onload = () => {
      const data = samplePointsFromImage(img, 48);
      initMesh(data);
    };
    img.onerror = () => {
      // Fallback procedural whale if image fails
      const count = 700;
      const positions = [];
      const opacities = [];
      const edges = [];
      const scattered = [];
      for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * Math.PI * 2;
        const r = Math.sqrt(v);
        const x = (r * Math.cos(theta)) * 2.8;
        const y = (r * Math.sin(theta) * 0.65) * 2.0;
        const z = (Math.random() - 0.5) * 0.2;
        positions.push(x, y, z);
        opacities.push(0.85);
        edges.push(r > 0.8 ? 1.0 : 0.2);
        scattered.push(x * 3 + (Math.random() - 0.5) * 4, y * 3 + (Math.random() - 0.5) * 4, z * 4);
      }
      initMesh({
        count,
        positions: new Float32Array(positions),
        opacities: new Float32Array(opacities),
        edges: new Float32Array(edges),
        scattered: new Float32Array(scattered),
      });
    };

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouse.targetX = x;
      mouse.targetY = y;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || 800;
      height = container.clientHeight || 800;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    const animate = (time) => {
      animId = requestAnimationFrame(animate);

      const elapsed = (time - startTime) * 0.001;
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      if (shaderMat) {
        shaderMat.uniforms.uTime.value = elapsed;
        shaderMat.uniforms.uAssembly.value = Math.min(1.0, elapsed / 1.6);
        shaderMat.uniforms.uMouse.value.set(mouse.x * 3.5, mouse.y * 3.5);
      }

      whaleGroup.rotation.y = THREE.MathUtils.lerp(whaleGroup.rotation.y, mouse.x * 0.28, 0.04);
      whaleGroup.rotation.x = THREE.MathUtils.lerp(whaleGroup.rotation.x, -mouse.y * 0.2, 0.04);
      whaleGroup.position.y = Math.sin(elapsed * 0.8) * 0.12;

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center pointer-events-none ${className}`}
      style={{ minWidth: 320, minHeight: 320 }}
    >
      <canvas ref={canvasRef} className='w-full h-full block' />
    </div>
  );
}
