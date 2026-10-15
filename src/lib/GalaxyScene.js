import * as THREE from 'three';
import { gsap } from './gsap';
import { generateGalaxy } from './generateGalaxy';

const galaxyVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uExpand;
  uniform vec3 uMouse;
  uniform float uMouseStrength;
  uniform float uPulseRadius;
  uniform float uPulseStrength;
  uniform vec3 uTintColor;
  uniform float uTintMix;

  attribute float aScale;
  attribute vec3 aColor;

  varying vec3 vColor;

  void main() {
    vec3 p = position * uExpand;

    // differential rotation: inner stars orbit faster than outer ones
    float dist = length(p.xz);
    float angle = atan(p.z, p.x) - uTime * (0.55 / (dist + 0.9));
    p.xz = vec2(cos(angle), sin(angle)) * dist;

    // the mouse disturbs the disk: stars lift and drift away from the cursor
    vec2 away = p.xz - uMouse.xz;
    float push = smoothstep(1.8, 0.0, length(away)) * uMouseStrength;
    p.y += push * 0.55;
    p.xz += normalize(away + 0.0001) * push * 0.3;

    // click shockwave: a bright ring that travels outward
    float ring = (1.0 - smoothstep(0.0, 0.7, abs(dist - uPulseRadius))) * uPulseStrength;
    p.y += ring * 0.35;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * (0.35 + aScale) * uPixelRatio * (1.0 + ring * 1.6 + push * 1.1);
    // clamp so particles never balloon when the camera dives in close
    gl_PointSize = min(size / -mv.z, 9.0 * uPixelRatio);

    float lum = dot(aColor, vec3(0.299, 0.587, 0.114));
    vec3 col = mix(aColor, uTintColor * (0.45 + lum), uTintMix);
    vColor = col + ring * 0.7 + push * vec3(0.35, 0.3, 0.6);
  }
`;

const galaxyFragment = /* glsl */ `
  uniform float uBrightness;
  uniform float uDim;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float strength = pow(1.0 - smoothstep(0.0, 0.5, d), 2.4);
    if (strength < 0.01) discard;
    gl_FragColor = vec4(vColor * strength * uBrightness * uDim, 1.0);
  }
`;

const starsVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aScale;
  attribute float aPhase;
  varying float vTwinkle;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vTwinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aScale * 1.8) + aPhase);
    gl_PointSize = (1.0 + aScale * 2.2) * uPixelRatio;
  }
`;

const starsFragment = /* glsl */ `
  uniform float uBrightness;
  varying float vTwinkle;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.1, 0.5, d);
    gl_FragColor = vec4(vec3(0.78, 0.82, 1.0) * a * vTwinkle * uBrightness, 1.0);
  }
`;

export class GalaxyScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.params = {
      count: this.mobile ? 28000 : 70000,
      branches: 4,
      spin: 1.1,
      randomness: 0.32
    };

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    this.group = new THREE.Group();
    this.group.rotation.z = -0.22;
    this.scene.add(this.group);

    this.time = 0;
    this.timeScale = 1;
    this.aspectZoom = 1;

    // camera rig: the scroll timeline (Galaxy.jsx) tweens these values
    this.view = { radius: 8, elevation: 0.45, azimuth: 0, lookX: 0, lookY: 0, fov: 60, zoom: 1 };
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };

    this.uniforms = {
      uTime: { value: 0 },
      uSize: { value: this.mobile ? 28 : 24 },
      uPixelRatio: { value: this.dpr },
      uExpand: { value: 0 },
      uMouse: { value: new THREE.Vector3(99, 0, 99) },
      uMouseStrength: { value: 0 },
      uPulseRadius: { value: 0 },
      uPulseStrength: { value: 0 },
      uTintColor: { value: new THREE.Color('#ff2045') },
      uTintMix: { value: 0 },
      uBrightness: { value: 1 },
      uDim: { value: 1 } // scroll-driven, separate from uBrightness (used by warp)
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: galaxyVertex,
      fragmentShader: galaxyFragment,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = null;
    this.buildGalaxy();
    this.buildStars();

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.ray = new THREE.Ray();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hit = new THREE.Vector3();
    this.inverse = new THREE.Matrix4();

    this.resize();
  }

  get info() {
    const gl = this.renderer.getContext();
    return {
      count: this.params.count,
      stars: this.starCount,
      gl: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl'
    };
  }

  buildGalaxy() {
    const { positions, colors, scales } = generateGalaxy(this.params);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    if (this.points) {
      this.points.geometry.dispose();
      this.points.geometry = geometry;
    } else {
      this.points = new THREE.Points(geometry, this.material);
      this.points.frustumCulled = false;
      this.group.add(this.points);
    }
  }

  buildStars() {
    const count = (this.starCount = this.mobile ? 1400 : 3200);
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.randomDirection().multiplyScalar(30 + Math.random() * 50);
      v.toArray(positions, i * 3);
      scales[i] = Math.random() ** 3;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.starsMaterial = new THREE.ShaderMaterial({
      vertexShader: starsVertex,
      fragmentShader: starsFragment,
      uniforms: {
        uTime: this.uniforms.uTime,
        uPixelRatio: this.uniforms.uPixelRatio,
        uBrightness: this.uniforms.uDim
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.stars = new THREE.Points(geometry, this.starsMaterial);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // portrait screens: pull back so the spiral still reads as a spiral
    this.aspectZoom = this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 0.35 : 1;
    this.camera.updateProjectionMatrix();
  };

  setPointer(clientX, clientY) {
    this.pointer.tx = (clientX / window.innerWidth) * 2 - 1;
    this.pointer.ty = -(clientY / window.innerHeight) * 2 + 1;
    this.pointer.active = true;
  }

  releasePointer() {
    this.pointer.active = false;
  }

  // gsap.ticker callback: (seconds, deltaMs)
  tick = (_, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.time += dt * this.timeScale * (this.reduceMotion ? 0.3 : 1);
    this.uniforms.uTime.value = this.time;

    // frame-rate independent smoothing for the pointer
    const p = this.pointer;
    const k = 1 - Math.exp(-dt * 4);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;

    const v = this.view;
    const r = v.radius * v.zoom * this.aspectZoom;
    const az = v.azimuth + p.x * 0.16;
    const el = Math.min(1.5, Math.max(-0.2, v.elevation + p.y * 0.08));
    this.camera.position.set(
      Math.sin(az) * Math.cos(el) * r + v.lookX,
      Math.sin(el) * r + v.lookY,
      Math.cos(az) * Math.cos(el) * r
    );
    this.camera.lookAt(v.lookX, v.lookY, 0);
    if (this.camera.fov !== v.fov) {
      this.camera.fov = v.fov;
      this.camera.updateProjectionMatrix();
    }

    // project the cursor onto the galaxy's disk (in the galaxy's own space)
    this.group.updateMatrixWorld();
    this.ndc.set(p.x, p.y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.inverse.copy(this.group.matrixWorld).invert();
    this.ray.copy(this.raycaster.ray).applyMatrix4(this.inverse);
    const target = p.active && this.ray.intersectPlane(this.plane, this.hit) ? 1 : 0;
    if (target) this.uniforms.uMouse.value.copy(this.hit);
    const m = this.uniforms.uMouseStrength;
    m.value += (target - m.value) * (1 - Math.exp(-dt * 3));

    this.stars.rotation.y = this.time * 0.006;
    this.renderer.render(this.scene, this.camera);
  };

  birth() {
    gsap.fromTo(this.uniforms.uExpand, { value: 0 }, { value: 1, duration: 3.2, ease: 'expo.out' });
    gsap.fromTo(this.view, { zoom: 0.55 }, { zoom: 1, duration: 3.4, ease: 'expo.out' });
    this.pulse(1.4);
  }

  pulse(strength = 1) {
    const u = this.uniforms;
    gsap.fromTo(u.uPulseRadius, { value: 0 }, { value: 7.5, duration: 2, ease: 'power2.out', overwrite: true });
    gsap.fromTo(u.uPulseStrength, { value: strength }, { value: 0, duration: 2, ease: 'power2.out', overwrite: true });
  }

  warp() {
    if (this.warping) return;
    this.warping = true;
    const tl = gsap.timeline({ onComplete: () => (this.warping = false) });
    tl.to(this, { timeScale: 38, duration: 1, ease: 'power3.in' })
      .to(this.view, { fov: 105, duration: 1, ease: 'power3.in' }, 0)
      .to(this.uniforms.uBrightness, { value: 1.8, duration: 1, ease: 'power2.in' }, 0)
      .add(() => this.pulse(2))
      .to(this, { timeScale: 1, duration: 2.2, ease: 'power3.out' }, '+=0.5')
      .to(this.view, { fov: 60, duration: 2.2, ease: 'power3.out' }, '<')
      .to(this.uniforms.uBrightness, { value: 1, duration: 2.2, ease: 'power2.out' }, '<');
    return tl;
  }

  setTint(color) {
    if (color) this.uniforms.uTintColor.value.set(color);
    gsap.to(this.uniforms.uTintMix, { value: color ? 1 : 0, duration: 1.4, ease: 'power2.inOut' });
  }

  // collapse → regenerate with new params → big bang
  rebuild(next = {}) {
    Object.assign(this.params, next);
    gsap.killTweensOf(this.uniforms.uExpand);
    return gsap
      .timeline()
      .to(this.uniforms.uExpand, { value: 0.02, duration: 0.6, ease: 'power3.in' })
      .add(() => this.buildGalaxy())
      .to(this.uniforms.uExpand, { value: 1, duration: 2.4, ease: 'expo.out' })
      .add(() => this.pulse(1.2), '<');
  }

  dispose() {
    gsap.killTweensOf([this, this.view, ...Object.values(this.uniforms)]);
    this.points?.geometry.dispose();
    this.material.dispose();
    this.stars?.geometry.dispose();
    this.starsMaterial?.dispose();
    // no forceContextLoss(): the <canvas> is reused on hot reload
    this.renderer.dispose();
  }
}
