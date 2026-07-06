export const HEAT_DISTORTION_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uHeat: { value: 0 },
    uFlash: { value: 0 },
    uResolution: { value: [1, 1] },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uHeat;
    uniform float uFlash;
    uniform vec2 uResolution;

    varying vec2 vUv;

    float grain(vec2 uv) {
      return fract(sin(dot(uv * uResolution + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float radius = length(centered);
      float heatMask = smoothstep(0.78, 0.08, radius) * uHeat;
      vec2 shimmer = vec2(
        sin(vUv.y * 48.0 + uTime * 3.2),
        cos(vUv.x * 34.0 - uTime * 2.4)
      ) * 0.0065 * heatMask;
      vec2 punch = normalize(centered + 0.0001) * uFlash * 0.012 * smoothstep(0.55, 0.0, radius);
      vec2 uv = vUv + shimmer + punch;

      vec4 color;
      color.r = texture2D(tDiffuse, uv + vec2(0.0018, 0.0) * heatMask).r;
      color.g = texture2D(tDiffuse, uv).g;
      color.b = texture2D(tDiffuse, uv - vec2(0.0014, 0.0) * heatMask).b;
      color.a = texture2D(tDiffuse, vUv).a;

      float vignette = smoothstep(0.95, 0.28, radius);
      float film = (grain(vUv) - 0.5) * 0.045;
      color.rgb = color.rgb * (0.86 + vignette * 0.22) + film;
      color.rgb += vec3(1.0, 0.86, 0.62) * uFlash * smoothstep(0.72, 0.0, radius) * 0.08;
      gl_FragColor = color;
    }
  `,
};
