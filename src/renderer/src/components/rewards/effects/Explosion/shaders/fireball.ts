import { GLSL_NOISE } from './noise';

export const FIREBALL_VERTEX_SHADER = `
${GLSL_NOISE}

uniform float uTime;
uniform float uGrowth;
uniform float uTurbulence;

varying vec3 vNormalWorld;
varying vec3 vPositionWorld;
varying float vHeat;
varying float vRimSeed;

void main() {
  vec3 n = normalize(normal);
  float rolling = fbm(n * 3.6 + vec3(uTime * 0.42, -uTime * 0.28, uTime * 0.19));
  float cellular = fbm(n * 9.2 + vec3(-uTime * 0.84, uTime * 0.31, uTime * 0.47));
  float displacement = (rolling * 0.62 + cellular * 0.38 - 0.48) * uTurbulence;
  vec3 displaced = position + n * displacement;

  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vNormalWorld = normalize(mat3(modelMatrix) * n);
  vPositionWorld = world.xyz;
  vHeat = clamp(rolling * 0.72 + cellular * 0.46 + uGrowth * 0.25, 0.0, 1.35);
  vRimSeed = cellular;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const FIREBALL_FRAGMENT_SHADER = `
${GLSL_NOISE}

uniform float uTime;
uniform float uOpacity;
uniform float uCooling;
uniform vec3 uCameraPosition;

varying vec3 vNormalWorld;
varying vec3 vPositionWorld;
varying float vHeat;
varying float vRimSeed;

vec3 fireRamp(float heat) {
  vec3 whiteHot = vec3(1.0, 0.98, 0.88);
  vec3 yellow = vec3(1.0, 0.78, 0.22);
  vec3 orange = vec3(1.0, 0.32, 0.05);
  vec3 red = vec3(0.55, 0.06, 0.02);
  vec3 soot = vec3(0.08, 0.045, 0.03);

  vec3 color = mix(soot, red, smoothstep(0.02, 0.22, heat));
  color = mix(color, orange, smoothstep(0.22, 0.52, heat));
  color = mix(color, yellow, smoothstep(0.48, 0.78, heat));
  color = mix(color, whiteHot, smoothstep(0.76, 1.05, heat));
  return color;
}

void main() {
  vec3 viewDir = normalize(uCameraPosition - vPositionWorld);
  float fresnel = pow(1.0 - max(dot(normalize(vNormalWorld), viewDir), 0.0), 2.3);
  float flow = fbm(vPositionWorld * 2.1 + vec3(uTime * 0.34, -uTime * 0.52, uTime * 0.18));
  float veins = fbm(vPositionWorld * 5.8 + vec3(-uTime * 0.92, uTime * 0.37, 1.7));
  float heat = vHeat + flow * 0.42 + veins * 0.24 - uCooling * 0.72;
  vec3 color = fireRamp(heat);
  color += vec3(1.0, 0.58, 0.2) * fresnel * (0.8 - uCooling * 0.35);
  color += vec3(0.28, 0.05, 0.02) * smoothstep(0.72, 1.0, uCooling) * (1.0 - vRimSeed);

  float alpha = uOpacity * (0.62 + fresnel * 0.34 + flow * 0.2);
  alpha *= 1.0 - smoothstep(0.94, 1.32, uCooling);
  gl_FragColor = vec4(color, alpha);
}
`;
