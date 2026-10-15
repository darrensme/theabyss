import * as THREE from 'three';
import { gsap } from './gsap';

// A realistic eye drawn entirely in a fragment shader: curved wet eyeball with
// veins, fibrous iris, pupil, a corneal reflection that stays fixed to the light,
// and eyelids that cast a shadow. GSAP drives every uniform.

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform float uOpen;   // 0 shut → 1 open
  uniform vec2 uLook;    // -1..1 where the eye is looking
  uniform float uPupil;  // 0 constricted → 1 dilated
  uniform float uRed;    // 0 normal → 1 the abyss is angry
  uniform vec3 uTint;    // iris colour

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    // eye space: y in -1..1, x scaled by aspect
    vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0;
    float aa = 3.0 / uRes.y;

    // ── eyelids: an almond opening; the upper lid follows the gaze down ──
    float W = 1.55;
    float t = clamp(1.0 - (p.x * p.x) / (W * W), 0.0, 1.0);
    float upper = (mix(-0.04, 0.74, uOpen) + uLook.y * 0.07 * uOpen) * pow(t, 0.8) + 0.03 * (1.0 - t);
    float lower = -mix(0.0, 0.5, uOpen) * pow(t, 1.15) - 0.02 * (1.0 - t);
    float inside = smoothstep(-aa, aa, upper - p.y) * smoothstep(-aa, aa, p.y - lower) * smoothstep(0.0, 0.02, t);

    // ── eyeball (a sphere bulging toward us) ──
    float ballR = 1.75;
    float z = sqrt(max(ballR * ballR - dot(p, p), 0.0)) / ballR;

    // one dim key light from the upper left: the eyeball shades as a sphere
    vec3 n = normalize(vec3(p / ballR, z));
    float light = 0.28 + 0.72 * max(dot(n, normalize(vec3(-0.55, 0.6, 0.75))), 0.0);

    vec3 sclera = vec3(0.74, 0.69, 0.66);
    sclera = mix(sclera, vec3(0.78, 0.46, 0.46), smoothstep(0.95, 1.5, abs(p.x)) * 0.65); // pink corners
    float edge = smoothstep(0.35, 1.45, length(p));
    float vein1 = 1.0 - smoothstep(0.0, 0.03, abs(fbm(p * 3.2 + 3.1) - 0.5));
    float vein2 = 1.0 - smoothstep(0.0, 0.018, abs(fbm(p * 7.5 + 9.0) - 0.5));
    sclera = mix(sclera, vec3(0.62, 0.08, 0.1), (vein1 * 0.6 + vein2 * 0.35) * edge * (0.45 + uRed * 0.9));
    sclera *= (0.3 + 0.7 * pow(z, 0.8)) * light;

    // ── iris ──
    vec2 c = uLook * vec2(0.55, 0.24);
    vec2 d = p - c;
    float lookLen = length(c);
    if (lookLen > 0.001) {
      // looking sideways turns the iris into an oval (it's a disc on a sphere)
      vec2 n = c / lookLen;
      d += n * dot(d, n) * lookLen * 0.7;
    }
    float R = 0.47;
    float rn = length(d) / R;
    float ang = atan(d.y, d.x);
    vec2 ring = vec2(cos(ang), sin(ang));

    float streak = fbm(ring * 14.0 + rn * vec2(1.3, 0.8) * 3.0);
    float fine = fbm(ring * 34.0 + rn * 7.0);
    vec3 iris = mix(uTint * 0.35, uTint * 0.85, smoothstep(1.0, 0.4, rn));
    iris = mix(iris, vec3(0.92, 0.66, 0.34), smoothstep(0.62, 0.34, rn) * 0.7); // warm ring around the pupil
    iris *= 0.45 + 1.0 * streak * (0.65 + 0.35 * fine);
    float crypt = smoothstep(0.6, 0.72, fbm(ring * 5.0 + rn * 4.0 + 7.0));
    iris *= 1.0 - crypt * 0.5 * smoothstep(0.92, 0.5, rn);
    iris *= 1.0 - smoothstep(0.76, 1.0, rn) * 0.8; // dark limbal ring
    iris = mix(iris, vec3(dot(iris, vec3(0.3, 0.5, 0.2))), 0.3); // real irises are muted
    iris *= 0.55 + 0.45 * light;
    iris = mix(iris, vec3(0.85, 0.05, 0.07) * (0.35 + streak), uRed * 0.85);
    float irisMask = 1.0 - smoothstep(1.0 - 2.5 * aa / R, 1.0, rn);

    // ── pupil (edge slightly irregular, like a real one) ──
    float pr = mix(0.26, 0.6, uPupil) * (1.0 + (noise(ring * 6.0) - 0.5) * 0.05);
    float pupil = 1.0 - smoothstep(pr - 0.015, pr + 0.012, rn);

    vec3 col = mix(sclera, iris, irisMask);
    col = mix(col, vec3(0.004), pupil);

    // ── cornea: reflections stay put while the eye moves ──
    float cornea = 1.0 - smoothstep(1.05, 1.2, rn);
    vec2 h = p - vec2(-0.2, 0.22);
    float spec = smoothstep(0.1, 0.04, length(h * vec2(1.0, 1.35)));
    float spec2 = smoothstep(0.035, 0.012, length(p - vec2(0.16, -0.14)));
    col += vec3(1.0) * (spec * 0.85 + spec2 * 0.45) * cornea;
    col += vec3(0.05) * pow(z, 10.0); // wet sheen

    // ── lid shadows on the eyeball ──
    col *= 1.0 - smoothstep(0.38, 0.0, upper - p.y) * 0.7;
    col *= 1.0 - smoothstep(0.12, 0.0, p.y - lower) * 0.35;
    float tear = smoothstep(0.025, 0.0, abs(p.y - lower - 0.015)) * t;
    col += vec3(0.5, 0.55, 0.6) * tear * 0.18;

    // ── skin around the eye, lit faintly red by the abyss ──
    vec3 skin = vec3(0.1, 0.035, 0.04) * (0.55 + 0.45 * fbm(p * 9.0));
    float rimU = smoothstep(0.07, 0.0, abs(p.y - upper - 0.025)) * t;
    float rimL = smoothstep(0.05, 0.0, abs(p.y - lower + 0.02)) * t;
    skin += vec3(0.38, 0.12, 0.12) * (rimU * 0.45 + rimL * 0.65);
    float crease = smoothstep(0.05, 0.0, abs(p.y - (upper + 0.32 * t + 0.05))) * t;
    skin *= 1.0 - crease * 0.5;

    vec3 outCol = mix(skin, col, inside);
    // fade the skin into the void, keep the eye itself solid
    vec2 q = abs(vUv * 2.0 - 1.0);
    float fade = smoothstep(1.85, 0.95, length(p * vec2(0.72, 1.15)))
               * (1.0 - smoothstep(0.7, 0.98, q.x)) * (1.0 - smoothstep(0.6, 0.97, q.y));
    float alpha = max(inside, fade);
    gl_FragColor = vec4(outCol * alpha, alpha);
  }
`;

export class EyeRenderer {
  constructor(canvas, { tint = '#7a6cb4' } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uOpen: { value: 0 },
      uLook: { value: new THREE.Vector2(0, 0) },
      uPupil: { value: 0.95 },
      uRed: { value: 0 },
      uTint: { value: new THREE.Color(tint) }
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: this.uniforms,
      transparent: true,
      blending: THREE.NoBlending
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);

    // where the eye wants to look, plus tiny involuntary darts (saccades)
    this.gaze = { x: 0, y: 0 };
    this.jitter = { x: 0, y: 0 };
    const look = this.uniforms.uLook.value;
    this.lx = gsap.quickTo(look, 'x', { duration: 0.35, ease: 'power3.out' });
    this.ly = gsap.quickTo(look, 'y', { duration: 0.35, ease: 'power3.out' });
    this.saccade = gsap.delayedCall(1, this.dart);

    this.resize();
    window.addEventListener('resize', this.resize);
    gsap.ticker.add(this.render);
  }

  resize = () => {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.uniforms.uRes.value.set(w, h);
  };

  render = () => this.renderer.render(this.scene, this.camera);

  dart = () => {
    this.jitter.x = (Math.random() - 0.5) * 0.12;
    this.jitter.y = (Math.random() - 0.5) * 0.1;
    this.aim();
    this.saccade = gsap.delayedCall(0.6 + Math.random() * 1.6, this.dart);
  };

  aim() {
    this.lx(Math.max(-1, Math.min(1, this.gaze.x + this.jitter.x)));
    this.ly(Math.max(-1, Math.min(1, this.gaze.y + this.jitter.y)));
  }

  lookAt(x, y) {
    this.gaze.x = x;
    this.gaze.y = y;
    this.aim();
  }

  // opens, and the pupil constricts as light hits it
  open(delay = 0) {
    const u = this.uniforms;
    return gsap
      .timeline({ delay })
      .to(u.uOpen, { value: 1, duration: 1.8, ease: 'expo.out' })
      .to(u.uPupil, { value: 0.35, duration: 1.4, ease: 'power2.out' }, 0.25);
  }

  blink() {
    return gsap
      .timeline()
      .to(this.uniforms.uOpen, { value: 0, duration: 0.08, ease: 'power2.in' })
      .to(this.uniforms.uOpen, { value: 1, duration: 0.2, ease: 'power2.out' });
  }

  // "stare back": the pupil blows wide, the eye goes red, then it blinks first
  stare() {
    const u = this.uniforms;
    return gsap
      .timeline()
      .to(u.uPupil, { value: 1, duration: 0.7, ease: 'power3.out' })
      .to(u.uRed, { value: 1, duration: 0.9, ease: 'power2.out' }, 0)
      .add(() => this.blink(), 1.6)
      .to(u.uPupil, { value: 0.35, duration: 1.4, ease: 'power2.out' }, 1.9)
      .to(u.uRed, { value: 0, duration: 3, ease: 'power2.inOut' }, 3.5);
  }

  dispose() {
    this.saccade?.kill();
    gsap.ticker.remove(this.render);
    window.removeEventListener('resize', this.resize);
    const u = this.uniforms;
    gsap.killTweensOf([u.uOpen, u.uPupil, u.uRed, u.uLook.value]);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // safe here: this canvas is thrown away with the room
  }
}
