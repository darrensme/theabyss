// Builds the spiral galaxy behind this page. Pure math, no textures.
// Returns typed arrays that go straight into a THREE.BufferGeometry.
export function generateGalaxy({
  count = 70000,
  radius = 6,
  branches = 4,
  spin = 1.1,
  randomness = 0.32,
  randomnessPower = 3,
  coreColor = [1.0, 0.64, 0.4],
  edgeColor = [0.38, 0.4, 1.0]
} = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  // random offset that hugs 0: most stars stay close to their arm
  const scatter = amount =>
    Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * amount;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    // pow() pushes more stars toward the bright core
    const r = Math.pow(Math.random(), 1.5) * radius;
    const branchAngle = ((i % branches) / branches) * Math.PI * 2;
    const spinAngle = r * spin;
    const spread = randomness * (0.4 + r);

    positions[i3] = Math.cos(branchAngle + spinAngle) * r + scatter(spread);
    positions[i3 + 1] = scatter(spread) * (0.45 - (r / radius) * 0.3);
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + scatter(spread);

    // hot core, cold edges
    const t = Math.min(r / radius, 1);
    colors[i3] = coreColor[0] + (edgeColor[0] - coreColor[0]) * t;
    colors[i3 + 1] = coreColor[1] + (edgeColor[1] - coreColor[1]) * t;
    colors[i3 + 2] = coreColor[2] + (edgeColor[2] - coreColor[2]) * t;

    scales[i] = Math.random();
  }

  return { positions, colors, scales };
}
