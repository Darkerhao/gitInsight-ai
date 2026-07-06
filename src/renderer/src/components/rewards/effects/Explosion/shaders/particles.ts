import { GLSL_NOISE } from './noise';

export const SMOKE_VERTEX_SHADER = `
${GLSL_NOISE}

attribute vec3 aBase;
attribute vec3 aDrift;
attribute float aBirth;
attribute float aLife;
attribute float aSize;
attribute float aSeed;
attribute float aLayer;

uniform float uTimeMs;
uniform float uGlobalOpacity;

varying float vAlpha;
varying float vLayer;
varying float vSeed;

void main() {
  float age = clamp((uTimeMs - aBirth) / aLife, 0.0, 1.25);
  float appear = smoothstep(0.0, 0.18, age);
  float fade = 1.0 - smoothstep(0.74, 1.08, age);
  float lift = age * age;
  float swirl = aSeed * 6.28318530718 + uTimeMs * (0.00022 + aLayer * 0.00008);
  vec3 pos = aBase;
  pos += aDrift * vec3(age * (0.6 + aLayer * 0.36), lift, age * (0.48 + aLayer * 0.18));
  pos.x += cos(swirl) * (0.12 + aLayer * 0.1) * age;
  pos.z += sin(swirl * 1.13) * (0.1 + aLayer * 0.12) * age;
  pos.y += fbm(vec3(pos.xz * 0.35, uTimeMs * 0.00018 + aSeed)) * 0.45 * age;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  float growth = 0.42 + age * (1.45 + aLayer * 0.38);
  gl_PointSize = aSize * growth * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;

  vAlpha = appear * fade * uGlobalOpacity;
  vLayer = aLayer;
  vSeed = aSeed;
}
`;

export const SMOKE_FRAGMENT_SHADER = `
varying float vAlpha;
varying float vLayer;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  float soft = smoothstep(0.5, 0.05, r);
  float inner = smoothstep(0.35, 0.0, r);
  vec3 ash = vec3(0.18, 0.16, 0.14);
  vec3 warm = vec3(0.68, 0.48, 0.32);
  vec3 pale = vec3(0.78, 0.74, 0.68);
  vec3 color = mix(ash, warm, 0.24 + vSeed * 0.26);
  color = mix(color, pale, inner * (0.14 + vLayer * 0.14));
  gl_FragColor = vec4(color, soft * vAlpha * (0.42 + inner * 0.24));
}
`;

export const FLAME_TRAIL_VERTEX_SHADER = `
attribute vec3 aOrigin;
attribute vec3 aVelocity;
attribute float aBirth;
attribute float aLife;
attribute float aSize;
attribute float aSeed;
attribute float aTrail;

uniform float uTimeMs;

varying float vAlpha;
varying float vHeat;

void main() {
  float ageMs = uTimeMs - aBirth;
  float age = clamp(ageMs / aLife, 0.0, 1.4);
  float live = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.62, 1.0, age));
  float seconds = max(ageMs, 0.0) * 0.001;
  vec3 gravity = vec3(0.0, -5.2, 0.0);
  vec3 pos = aOrigin + aVelocity * seconds + gravity * seconds * seconds * 0.5;
  pos -= aVelocity * aTrail * (0.04 + aSize * 0.002);
  pos.y += sin(uTimeMs * 0.004 + aSeed * 20.0) * 0.035;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  vAlpha = live * (1.0 - aTrail * 0.55);
  vHeat = 1.0 - age;
}
`;

export const FLAME_TRAIL_FRAGMENT_SHADER = `
varying float vAlpha;
varying float vHeat;

void main() {
  vec3 whiteHot = vec3(1.0, 0.96, 0.78);
  vec3 orange = vec3(1.0, 0.38, 0.05);
  vec3 red = vec3(0.58, 0.04, 0.01);
  vec3 color = mix(red, orange, smoothstep(0.15, 0.62, vHeat));
  color = mix(color, whiteHot, smoothstep(0.68, 1.0, vHeat));
  gl_FragColor = vec4(color, vAlpha);
}
`;

export const ASH_VERTEX_SHADER = `
attribute vec3 aBase;
attribute float aSeed;
attribute float aSpeed;
attribute float aSize;

uniform float uTimeMs;
uniform float uStartMs;
uniform float uOpacity;

varying float vAlpha;

void main() {
  float t = max(0.0, (uTimeMs - uStartMs) * 0.001);
  vec3 pos = aBase;
  pos.y -= mod(t * aSpeed + aSeed * 8.0, 8.0);
  pos.x += sin(t * (0.55 + aSeed) + aSeed * 31.0) * (0.28 + aSeed * 0.34);
  pos.z += cos(t * (0.42 + aSeed) + aSeed * 17.0) * 0.22;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (260.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = smoothstep(0.0, 1.0, t) * uOpacity * (0.45 + aSeed * 0.55);
}
`;

export const ASH_FRAGMENT_SHADER = `
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float soft = smoothstep(0.5, 0.05, length(uv));
  gl_FragColor = vec4(vec3(0.72, 0.69, 0.63), soft * vAlpha * 0.58);
}
`;
