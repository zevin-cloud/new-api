/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const DIGITILE_LIGHT_DEFAULTS = {
  x: 4.5,
  y: 5.5,
  z: 3,
  range: 14,
  shadeMin: 0.2,
  shadeMax: 1.116, // 0.4 * 2.79
  followX: 1.05,
};

const DIGITILE_MOUSE_DEFAULTS = {
  radius: 4.9,
  strength: 0.8,
  decay: 0.2,
  distort: 5,
};

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

      float tail = smoothstep(0.5, 4.5, targetCenter.x) * uLoose * assembly;
      pos.y += sin(uTime * 1.1 - targetCenter.x * 0.7) * 0.1 * tail;
      pos.z += cos(uTime * 0.9 - targetCenter.x * 0.55) * 0.06 * tail;
    }

    if (uScatter > 0.001) {
      float disperse = uScatter * mix(0.5, 1.0, aEdge);
      pos += (scatteredCenter - center) * disperse;
      pos.z += sin(uTime * 0.6 + aIndex * 0.3) * disperse * 0.6;
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

        pos.xy += pushDir * force * 2.0;
        pos.z += sin(aIndex * 1.7 + uTime) * force * 0.8;
      }
    }

    if (assembly < 0.9) {
      float scatter = smoothstep(0.9, 0.0, assembly);
      pos.x += sin(uTime * 0.5 + aIndex * 0.1) * 0.2 * scatter;
      pos.y += cos(uTime * 0.4 + aIndex * 0.07) * 0.2 * scatter;
      pos.z += sin(uTime * 0.3 + aIndex * 0.13) * 0.15 * scatter;
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

    float baseAlpha = mix(0.45, 0.75, vAssembly);
    float alpha = vOpacity * (baseAlpha + glow);
    float shimmer = sin(uTime * 1.5 + vWorldPos.x * 5.0 + vWorldPos.y * 3.0) * 0.1 + 0.9;
    alpha *= shimmer * min(vLight, 1.0);

    vec3 color = (uColor + glow * vec3(0.2, 0.3, 0.5)) * vLight;
    color = mix(color, color * vec3(1.07, 1.02, 0.94), clamp(vLight - 1.0, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
  }
`;

function processImageToPixels(img, size = 60) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  const imgData = ctx.getImageData(0, 0, size, size);
  const positions = [];
  const scattered = [];
  const opacities = [];
  const edges = [];
  const halfSize = size / 2;

  const coverageMap = new Float32Array(size * size);
  const lumMap = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const idx = 4 * i;
    coverageMap[i] = imgData.data[idx + 3] / 255;
    lumMap[i] =
      (0.299 * imgData.data[idx] +
        0.587 * imgData.data[idx + 1] +
        0.114 * imgData.data[idx + 2]) /
      255;
  }

  const isEdgePixel = (x, y) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < size &&
          ny < size &&
          coverageMap[ny * size + nx] > 0.12
        ) {
          return false;
        }
      }
    }
    return true;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const coverage = coverageMap[y * size + x];
      if (coverage > 0.12 && !isEdgePixel(x, y)) {
        const posX = (x - halfSize) * 0.18;
        const posY = (halfSize - y) * 0.18;
        positions.push(posX, posY, 0);
        opacities.push(Math.max(0.45, lumMap[y * size + x]) * coverage);

        let borderCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (
              nx < 0 ||
              ny < 0 ||
              nx >= size ||
              ny >= size ||
              coverageMap[ny * size + nx] <= 0.12
            ) {
              borderCount++;
            }
          }
        }
        edges.push(borderCount / 8);

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 3 * (0.4 + 0.6 * Math.random());
        scattered.push(
          Math.sin(phi) * Math.cos(theta) * radius,
          Math.sin(phi) * Math.sin(theta) * radius,
          Math.cos(phi) * radius * 0.5,
        );
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    scatteredPositions: new Float32Array(scattered),
    opacities: new Float32Array(opacities),
    edges: new Float32Array(edges),
    count: positions.length / 3,
  };
}

export default function DeepSeekWhale({
  src = '/new-api-icon.png',
  lightParams = DIGITILE_LIGHT_DEFAULTS,
  mouseParams = DIGITILE_MOUSE_DEFAULTS,
  spin = false,
  loose = 1,
}) {
  const containerRef = useRef(null);
  const [pixelData, setPixelData] = useState(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const mouseActiveRef = useRef(false);
  const mouseHasMovedRef = useRef(false);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    setPixelData(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        setPixelData(processImageToPixels(img, 60));
      } catch (error) {
        if (img.src.endsWith('/new-api-icon.png')) return;
        img.src = '/new-api-icon.png';
      }
    };
    img.onerror = () => {
      if (img.src.endsWith('/new-api-icon.png')) return;
      img.src = '/new-api-icon.png';
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      mouseActiveRef.current = true;
      mouseHasMovedRef.current = true;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };

    const handleMouseLeave = () => {
      mouseActiveRef.current = false;
    };

    const handleVisibility = () => {
      if (document.hidden) mouseActiveRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!pixelData || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 800;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 18);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Official DeepSeek Harness BoxGeometry dimensions: 0.06 x 0.06 x 0.018
    const geometry = new THREE.BoxGeometry(0.06, 0.06, 0.018);
    const indexArray = new Float32Array(pixelData.count);
    for (let i = 0; i < pixelData.count; i++) indexArray[i] = i;

    geometry.setAttribute(
      'aOpacity',
      new THREE.InstancedBufferAttribute(pixelData.opacities, 1),
    );
    geometry.setAttribute(
      'aIndex',
      new THREE.InstancedBufferAttribute(indexArray, 1),
    );
    geometry.setAttribute(
      'aScattered',
      new THREE.InstancedBufferAttribute(pixelData.scatteredPositions, 3),
    );
    geometry.setAttribute(
      'aEdge',
      new THREE.InstancedBufferAttribute(pixelData.edges, 1),
    );

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uWaveSpeed: { value: 1.5 },
        uWaveAmount: { value: 0.06 },
        uLightPos: {
          value: new THREE.Vector3(lightParams.x, lightParams.y, lightParams.z),
        },
        uLightRange: { value: lightParams.range },
        uShadeMin: { value: lightParams.shadeMin },
        uShadeMax: { value: lightParams.shadeMax },
        uColor: { value: new THREE.Color(0.75, 0.8, 0.9) },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseRadius: { value: mouseParams.radius },
        uMouseStrength: { value: 0 },
        uMouseDistort: { value: mouseParams.distort },
        uAssembly: { value: 0 },
        uLoose: { value: loose },
        uScatter: { value: 0 },
      },
    });

    const instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      pixelData.count,
    );
    instancedMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < pixelData.count; i++) {
      dummy.position.set(
        pixelData.positions[3 * i],
        pixelData.positions[3 * i + 1],
        pixelData.positions[3 * i + 2],
      );
      const s = 0.5 + 1.0 * Math.random();
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;

    const group = new THREE.Group();
    group.add(instancedMesh);
    scene.add(group);

    let animFrame = 0;
    const clock = new THREE.Clock();
    let accumulatedTime = 0;
    let lastRenderTime = 0;
    const interval = 1000 / 30;

    const smoothMouse = new THREE.Vector2(0, 0);
    const invMatrix = new THREE.Matrix4();
    const localMouseVec = new THREE.Vector3();

    // Responsive 3D viewport dimensions at camera distance 18
    const vFOV = (camera.fov * Math.PI) / 180;
    const viewportHeight = 2 * Math.tan(vFOV / 2) * 18;
    const viewportWidth = viewportHeight * (width / height);

    const animate = (now) => {
      animFrame = requestAnimationFrame(animate);
      if (!isVisibleRef.current || now - lastRenderTime < interval) return;
      lastRenderTime = now - ((now - lastRenderTime) % interval);

      const delta = clock.getDelta();
      accumulatedTime += delta;

      const elapsedAssembly = accumulatedTime - 0.3;
      const progress = Math.max(0, Math.min(1, elapsedAssembly / 2.5));
      const assembly = 1 - Math.pow(1 - progress, 3);

      if (progress <= 0) {
        group.scale.setScalar(0);
        renderer.render(scene, camera);
        return;
      }

      material.uniforms.uAssembly.value = assembly;
      material.uniforms.uTime.value = accumulatedTime;

      // Mouse smoothing in world coordinates
      const targetMouseX = mouseRef.current.x * viewportWidth * 0.5;
      const targetMouseY = mouseRef.current.y * viewportHeight * 0.5;

      if (mouseHasMovedRef.current) {
        if (material.uniforms.uMouseStrength.value < 0.01) {
          smoothMouse.x = targetMouseX;
          smoothMouse.y = targetMouseY;
        } else {
          smoothMouse.x += (targetMouseX - smoothMouse.x) * mouseParams.decay;
          smoothMouse.y += (targetMouseY - smoothMouse.y) * mouseParams.decay;
        }
      }

      // Transform world mouse to local group space
      invMatrix.copy(group.matrixWorld).invert();
      localMouseVec.set(smoothMouse.x, smoothMouse.y, 0);
      localMouseVec.applyMatrix4(invMatrix);
      material.uniforms.uMouse.value.set(localMouseVec.x, localMouseVec.y);

      // Mouse strength smooth transition
      const targetStrength = mouseActiveRef.current ? mouseParams.strength : 0;
      const curStrength = material.uniforms.uMouseStrength.value;
      material.uniforms.uMouseStrength.value +=
        (targetStrength - curStrength) * (1 - Math.pow(0.05, delta));

      // Light position with followX
      const lightX = lightParams.x + smoothMouse.x * (lightParams.followX ?? 0);
      material.uniforms.uLightPos.value.set(
        lightX,
        lightParams.y,
        lightParams.z,
      );

      // Color intensity linked to assembly
      material.uniforms.uColor.value.setRGB(
        0.75 * assembly,
        0.8 * assembly,
        0.9 * assembly,
      );

      // Official rotational swim motion & scale
      group.rotation.z =
        accumulatedTime * ((spin ? 0.12 : 0) + (1 - assembly) * 0.3) +
        (spin ? 0 : 0.04 * Math.sin(0.25 * accumulatedTime));
      group.rotation.x = 0.05 * Math.sin(0.08 * accumulatedTime * 0.7);
      group.rotation.y = 0.1 * Math.sin(0.08 * accumulatedTime);
      group.position.y = 0.15 * Math.sin(0.4 * accumulatedTime);
      group.scale.setScalar(0.75 + 0.25 * assembly);

      renderer.render(scene, camera);
    };

    animFrame = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 800;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const observer = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [pixelData, lightParams, mouseParams, spin, loose]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
