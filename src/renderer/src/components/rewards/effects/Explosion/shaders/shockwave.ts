import { GLSL_NOISE } from './noise';

export const SHOCKWAVE_VERTEX_SHADER = `
varying vec3 vWorldPosition;
varying vec3 vNormalWorld;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const SHOCKWAVE_FRAGMENT_SHADER = `
${GLSL_NOISE}

uniform float uTime;
uniform float uOpacity;
uniform float uThickness;
uniform vec3 uCameraPosition;

varying vec3 vWorldPosition;
varying vec3 vNormalWorld;

void main() {
  vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(normalize(vNormalWorld), viewDir), 0.0), 2.0);
  float turbulence = fbm(vWorldPosition * 2.7 + vec3(uTime * 0.62, 0.0, -uTime * 0.38));
  float shell = smoothstep(0.18, 1.0, fresnel + turbulence * uThickness);
  vec3 color = mix(vec3(0.62, 0.88, 1.0), vec3(1.0, 0.86, 0.52), turbulence);
  gl_FragColor = vec4(color, uOpacity * shell);
}
`;

export const DUST_RING_VERTEX_SHADER = `
attribute float aSeed;
attribute float aRadius;
attribute float aHeight;

uniform float uTime;
uniform float uProgress;

varying float vAlpha;
varying float vSeed;

void main() {
  vec3 transformed = position;
  float angle = aSeed * 6.28318530718;
  float radius = aRadius * (0.35 + uProgress * 1.8);
  transformed.x = cos(angle) * radius;
  transformed.z = sin(angle) * radius * 0.68;
  transformed.y = aHeight * smoothstep(0.0, 0.7, uProgress) + sin(uTime * 1.7 + aSeed * 24.0) * 0.08;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_PointSize = (38.0 + aSeed * 50.0) * (1.0 - uProgress * 0.34) * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = smoothstep(0.0, 0.18, uProgress) * (1.0 - smoothstep(0.62, 1.0, uProgress));
  vSeed = aSeed;
}
`;

export const DUST_RING_FRAGMENT_SHADER = `
varying float vAlpha;
varying float vSeed;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float radius = length(uv);
  float soft = smoothstep(0.5, 0.08, radius);
  vec3 color = mix(vec3(0.36, 0.29, 0.23), vec3(0.94, 0.62, 0.34), vSeed);
  gl_FragColor = vec4(color, soft * vAlpha * 0.72);
}
`;
