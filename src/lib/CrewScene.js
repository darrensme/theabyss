import * as THREE from 'three';
import { gsap } from './gsap';

// One WebGL canvas draws every crew member's object. Each card gets its own
// scene + camera, rendered into that card's rectangle with scissor tests
// (the "multiple views" technique), so 4 objects cost 1 GPU context.

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uExpand;
  uniform float uHover;
  uniform float uBurst;
  uniform vec3 uColor;

  attribute float aScale;
  attribute float aSpeed;
  attribute float aFlow;
  attribute vec2 aTint; // x: how much of the member colour (0 = white-hot), y: brightness

  varying vec3 vColor;

  void main() {
    vec3 p = position;
    float fade = 1.0;

    // jets: particles stream away from the poles and loop back
    if (aFlow > 0.0) {
      float len = 1.55;
      float d = mod(abs(p.y) + uTime * aFlow * (1.0 + uHover), len);
      p.xz *= (0.12 + d) / (0.12 + abs(p.y));
      p.y = sign(p.y) * d;
      fade = 1.0 - d / len;
    }

    // orbit around the local Y axis; hover spins everything faster
    float a = uTime * aSpeed * (1.0 + uHover * 1.6);
    p.xz = mat2(cos(a), sin(a), -sin(a), cos(a)) * p.xz;

    // tap: blow apart along each particle's direction, then reform
    p += normalize(position + 0.0001) * uBurst * (0.5 + aScale) * 1.3;
    p *= uExpand * (1.0 + uHover * 0.07);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float twinkle = 0.75 + 0.25 * sin(uTime * (1.5 + aScale * 3.0) + aScale * 40.0);
    gl_PointSize = min(uSize * (0.35 + aScale) * uPixelRatio / -mv.z, 7.0 * uPixelRatio);

    vec3 col = mix(vec3(1.0, 0.97, 0.92), uColor, aTint.x);
    vColor = col * aTint.y * fade * twinkle * (1.0 + uHover * 0.35 + uBurst * 0.6);
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float strength = pow(1.0 - smoothstep(0.0, 0.5, d), 2.2);
    if (strength < 0.01) discard;
    gl_FragColor = vec4(vColor * strength, 1.0);
  }
`;

// deterministic randomness from a string: same name → same object every visit
function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const signed = rand => (rand() < 0.5 ? -1 : 1);

// ── the four kinds of object ──────────────────────────────────
// each writes particle i and returns nothing; `put` stores the attributes
const FORMS = {
  spiral: {
    label: 'spiral galaxy',
    tilt: [1.08, 0, 0.3],
    build(n, rand, put) {
      const branches = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        if (i % 12 === 0) {
          // central bulge
          const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.pow(rand(), 2) * 0.3);
          put(i, v.x, v.y * 0.6, v.z, rand(), 0.5, 0, 0.2, 0.9);
          continue;
        }
        const r = 0.12 + Math.pow(rand(), 1.2) * 1.65;
        const angle = ((i % branches) / branches) * Math.PI * 2 + r * 3;
        // tight scatter so the arms read clearly at this small size
        const s = () => Math.pow(rand(), 3) * signed(rand) * 0.2 * (0.2 + r);
        put(i, Math.cos(angle) * r + s(), s() * 0.35, Math.sin(angle) * r + s(), rand(), 0.85 / (r + 0.45), 0, 0.25 + (r / 1.75) * 0.75, 0.75 + rand() * 0.5);
      }
    }
  },

  planet: {
    label: 'ringed planet',
    tilt: [0.38, 0, 0.38],
    build(n, rand, put) {
      const sphere = Math.floor(n * 0.55);
      const light = new THREE.Vector3(-1, 0.7, 0.9).normalize();
      for (let i = 0; i < n; i++) {
        if (i < sphere) {
          // fibonacci sphere: evenly spread surface, lit from one side
          const y = 1 - (i / (sphere - 1)) * 2;
          const rad = Math.sqrt(1 - y * y);
          const th = i * 2.399963;
          const v = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad);
          const lit = Math.max(0, v.dot(light));
          v.multiplyScalar(0.82 + (rand() - 0.5) * 0.03);
          put(i, v.x, v.y, v.z, rand() * 0.6, 0.22, 0, 0.75, 0.12 + lit * 1.05);
        } else {
          // ring with a gap in it
          let r = 1.2 + rand() * 0.95;
          if (r > 1.68 && r < 1.78) r += 0.12;
          const th = rand() * Math.PI * 2;
          put(i, Math.cos(th) * r, (rand() - 0.5) * 0.025, Math.sin(th) * r, rand(), 0.55 / r, 0, 0.45 + rand() * 0.5, 0.45 + rand() * 0.5);
        }
      }
    }
  },

  blackhole: {
    label: 'black hole',
    tilt: [0.28, 0, -0.14],
    build(n, rand, put) {
      const disk = Math.floor(n * 0.82);
      for (let i = 0; i < n; i++) {
        if (i < disk) {
          // accretion disk: dense, hot and fast near the edge of the hole
          const r = 0.55 + Math.pow(rand(), 2.2) * 1.65;
          const th = rand() * Math.PI * 2;
          const t = (r - 0.55) / 1.65;
          put(i, Math.cos(th) * r, (rand() - 0.5) * 0.06 * r, Math.sin(th) * r, rand(), 1.4 / (r * r + 0.15), 0, 0.1 + t * 0.9, 1.45 - t * 0.85);
        } else {
          // photon ring: light bent all the way around the hole
          const th = rand() * Math.PI * 2;
          const r = 0.6 + (rand() - 0.5) * 0.03;
          put(i, Math.cos(th) * r, Math.sin(th) * r, (rand() - 0.5) * 0.02, rand() * 0.5, 0, 0, 0.3, 1.25);
        }
      }
    }
  },

  pulsar: {
    label: 'pulsar',
    tilt: [0.18, 0, 0.45],
    build(n, rand, put) {
      const core = Math.floor(n * 0.22);
      const jets = core + Math.floor(n * 0.4);
      for (let i = 0; i < n; i++) {
        if (i < core) {
          const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.pow(rand(), 2) * 0.3);
          put(i, v.x, v.y, v.z, rand(), 2.2, 0, 0.15, 1.6);
        } else if (i < jets) {
          // jet particles: the shader moves them outward along Y
          const t = rand();
          const th = rand() * Math.PI * 2;
          const r = (0.04 + t * 0.22) * rand();
          put(i, Math.cos(th) * r, signed(rand) * (0.05 + t * 2), Math.sin(th) * r, rand(), 3, 0.5 + rand() * 0.7, 0.55, 1.3);
        } else {
          // faint spinning disk, so the jets stay the star of the show
          const r = 0.34 + Math.pow(rand(), 1.6) * 0.8;
          const th = rand() * Math.PI * 2;
          put(i, Math.cos(th) * r, (rand() - 0.5) * 0.04, Math.sin(th) * r, rand() * 0.6, 1.3 / (r + 0.3), 0, 0.9, 0.16 + rand() * 0.2);
        }
      }
    }
  }
};

export const formLabel = form => (FORMS[form] ?? FORMS.spiral).label;

export class CrewScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    this.count = this.mobile ? 4500 : 9000;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
    this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    this.views = [];
    this.time = 0;
    this.active = false;
    this.resize();
  }

  addView({ el, frame, name, color, form }) {
    const kind = FORMS[form] ?? FORMS.spiral;
    const rand = seeded(name.toLowerCase());
    const n = this.count;
    const positions = new Float32Array(n * 3);
    const scales = new Float32Array(n);
    const speeds = new Float32Array(n);
    const flows = new Float32Array(n);
    const tints = new Float32Array(n * 2);
    const put = (i, x, y, z, scale, speed, flow, mix, bright) => {
      positions.set([x, y, z], i * 3);
      scales[i] = scale;
      speeds[i] = speed;
      flows[i] = flow;
      tints[i * 2] = mix;
      tints[i * 2 + 1] = bright;
    };
    kind.build(n, rand, put);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('aFlow', new THREE.BufferAttribute(flows, 1));
    geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 2));

    const uniforms = {
      uTime: { value: 0 },
      uSize: { value: 22 },
      uPixelRatio: { value: this.dpr },
      uExpand: { value: 0 },
      uHover: { value: 0 },
      uBurst: { value: 0 },
      uColor: { value: new THREE.Color(color) }
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms,
      transparent: true,
      depthWrite: false,
      // pure light: add colour, never touch the canvas alpha. This canvas sits
      // *on top of* the cards, so any alpha would show up as dark smudges.
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;

    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.add(points);
    scene.add(group);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, 0, 8.4);

    const view = {
      el, // where the object sits
      frame, // the card: drawing is clipped to it, so bursts can spill past the slot
      scene,
      camera,
      group,
      uniforms,
      geometry,
      material,
      base: kind.tilt,
      tilt: { x: 0, y: 0 },
      offset: rand() * 100
    };
    this.views.push(view);
    return view;
  }

  // ── interactions (all GSAP) ──
  birth(view, delay = 0) {
    if (view.born) return;
    view.born = true;
    gsap.fromTo(view.uniforms.uExpand, { value: 0 }, { value: 1, duration: 2.4, delay, ease: 'expo.out' });
  }

  hover(view, on) {
    gsap.to(view.uniforms.uHover, { value: on ? 1 : 0, duration: on ? 0.6 : 1.2, ease: 'power3.out' });
  }

  ping(view) {
    gsap
      .timeline()
      .to(view.uniforms.uBurst, { value: 1, duration: 0.35, ease: 'power3.out', overwrite: true })
      .to(view.uniforms.uBurst, { value: 0, duration: 1.6, ease: 'elastic.out(1, 0.35)' });
  }

  resize = () => {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w && h) this.renderer.setSize(w, h, false);
    this.height = h;
  };

  // gsap.ticker callback
  tick = (_, deltaMs) => {
    if (!this.active) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.time += dt;
    const r = this.renderer;
    r.setScissorTest(false);
    r.clear();
    r.setScissorTest(true);
    const H = this.height;

    for (const v of this.views) {
      const slot = v.el.getBoundingClientRect();
      const card = v.frame.getBoundingClientRect();
      if (card.bottom < 0 || card.top > H || slot.width === 0) continue;

      // viewport = slot grown on every side (so the object can be big),
      // scissor = the card (so nothing draws outside it)
      const pad = slot.width * 0.3;
      const vw = slot.width + pad * 2;
      const vh = slot.height + pad * 2;
      r.setViewport(slot.left - pad, H - slot.bottom - pad, vw, vh);
      r.setScissor(card.left, H - card.bottom, card.width, card.height);
      v.camera.aspect = vw / vh;
      v.camera.updateProjectionMatrix();

      v.uniforms.uTime.value = this.time + v.offset;
      v.group.rotation.set(v.base[0] + v.tilt.y * 0.5, v.base[1] + v.tilt.x * 0.7, v.base[2]);
      r.render(v.scene, v.camera);
    }
  };

  dispose() {
    for (const v of this.views) {
      gsap.killTweensOf([v.uniforms.uExpand, v.uniforms.uHover, v.uniforms.uBurst, v.tilt]);
      v.geometry.dispose();
      v.material.dispose();
    }
    // no forceContextLoss(): on a hot reload React keeps this same <canvas>,
    // and a canvas whose context was killed can never render again
    this.renderer.dispose();
  }
}
