import { useMemo } from 'react';
import * as THREE from 'three';

const BASE = 0.34; // ride height at the sills
const HALF_W = 0.975;
const X0 = -2.49, X1 = 2.49;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const sgnPow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

/** y(x) from a list of 2D points, linearly interpolated (points sampled densely from splines). */
function lookup(pts: THREE.Vector2[]) {
  return (x: number) => {
    if (x <= pts[0].x) return pts[0].y;
    for (let i = 1; i < pts.length; i++) if (x <= pts[i].x) { const a = pts[i - 1], b = pts[i]; return a.y + ((x - a.x) / (b.x - a.x || 1)) * (b.y - a.y); }
    return pts[pts.length - 1].y;
  };
}
const spline = (pts: [number, number][]) => new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(220);

// Lower body top line (deck, belt, bonnet) and the glasshouse roofline.
const bodyTop = lookup(spline([[-2.49, 0.6], [-2.42, 0.84], [-2.2, 0.97], [-1.7, 1.02], [-0.4, 1.04], [1.2, 1.03], [1.6, 0.97], [2.2, 0.82], [2.44, 0.7], [2.49, 0.56]]));
const roof = lookup(spline([[-1.62, 1.0], [-1.25, 1.13], [-0.8, 1.36], [-0.25, 1.46], [0.3, 1.47], [0.75, 1.38], [1.05, 1.2], [1.38, 1.02]]));

function archLift(x: number) {
  let lift = 0;
  for (const c of [1.5, -1.5]) { const d = Math.abs(x - c); if (d < 0.46) lift = Math.max(lift, Math.sqrt(0.46 * 0.46 - d * d)); }
  return lift;
}

/**
 * Loft a smooth body through cross-sections (rounded superellipses) along x.
 * `top`/`bottom` give the vertical extent at each station, `half` the half width. Indexed grid = clean smooth shading.
 */
function loft(opts: { x0: number; x1: number; top: (x: number) => number; bottom: (x: number) => number; half: (x: number) => number; n: number; stations?: number }) {
  const N = opts.stations ?? 180, M = 56;
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = opts.x0 + ((opts.x1 - opts.x0) * i) / N;
    const closeF = Math.sqrt(Math.min(1, Math.max(0, Math.min(x - opts.x0, opts.x1 - x) / 0.16)));
    const yb = opts.bottom(x), yt = Math.max(yb + 0.002, opts.top(x));
    const hh = ((yt - yb) / 2) * closeF, ym = (yt + yb) / 2, hw = opts.half(x) * closeF;
    for (let k = 0; k <= M; k++) {
      const t = -Math.PI / 2 + (2 * Math.PI * k) / M;
      pos.push(x, ym + hh * sgnPow(Math.sin(t), 2 / opts.n), hw * sgnPow(Math.cos(t), 2 / opts.n));
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < M; k++) { const a = i * (M + 1) + k, b = a + M + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Wheel({ x, z }: { x: number; z: number }) {
  const spokes = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2), []);
  const s = z > 0 ? 1 : -1;
  return (
    <group position={[x, BASE, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh><cylinderGeometry args={[0.37, 0.37, 0.27, 56]} /><meshStandardMaterial color="#0A0C11" roughness={0.9} /></mesh>
      <mesh position={[0, s * 0.136, 0]}><cylinderGeometry args={[0.262, 0.262, 0.02, 56]} /><meshStandardMaterial color="#10141C" metalness={0.9} roughness={0.3} /></mesh>
      {spokes.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.145, s * 0.148, Math.sin(a) * 0.145]} rotation={[0, -a, 0]}>
          <boxGeometry args={[0.21, 0.012, 0.034]} /><meshStandardMaterial color="#C9D3EC" metalness={1} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, s * 0.15, 0]}><cylinderGeometry args={[0.045, 0.045, 0.02, 24]} /><meshStandardMaterial color="#8CA3EF" metalness={1} roughness={0.2} /></mesh>
    </group>
  );
}

/** Generic premium electric sedan: pearl-blue clearcoat body, panoramic dark glasshouse, full-width light bars. No brand marks. */
export function Car() {
  const body = useMemo(() => loft({
    x0: X0, x1: X1, n: 3.4,
    top: bodyTop, bottom: (x) => BASE + archLift(x),
    half: (x) => HALF_W * (1 - 0.2 * smooth(1.5, 2.49, x) - 0.16 * smooth(-1.4, -2.49, x)),
  }), []);
  const glass = useMemo(() => loft({
    x0: -1.64, x1: 1.42, n: 2.5, stations: 140,
    top: (x) => roof(x), bottom: () => 0.99,
    half: (x) => 0.78 * (0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, Math.max(0, (x + 1.64) / 3.06)))),
  }), []);
  return (
    <group>
      <mesh geometry={body} castShadow>
        <meshPhysicalMaterial color="#1E3F9E" metalness={0.8} roughness={0.26} clearcoat={1} clearcoatRoughness={0.06} envMapIntensity={1.35} />
      </mesh>
      <mesh geometry={glass}><meshPhysicalMaterial color="#0B1428" metalness={0.55} roughness={0.1} clearcoat={1} envMapIntensity={1.7} /></mesh>
      <mesh position={[0, BASE - 0.03, 0]}><boxGeometry args={[4.5, 0.05, 1.5]} /><meshStandardMaterial color="#04060A" roughness={0.95} /></mesh>
      {[1.5, -1.5].flatMap((x) => [0.8, -0.8].map((z) => <Wheel key={`${x}${z}`} x={x} z={z} />))}
      {/* light signatures */}
      <mesh position={[2.43, 0.7, 0]}><boxGeometry args={[0.05, 0.035, 1.1]} /><meshBasicMaterial color="#EAF2FF" toneMapped={false} /></mesh>
      <mesh position={[-2.44, 0.88, 0]}><boxGeometry args={[0.04, 0.045, 1.25]} /><meshBasicMaterial color="#FF2B3A" toneMapped={false} /></mesh>
      {/* mirrors */}
      {[0.93, -0.93].map((z) => <mesh key={z} position={[0.95, 1.04, z]}><boxGeometry args={[0.2, 0.08, 0.1]} /><meshPhysicalMaterial color="#10141C" metalness={0.5} roughness={0.3} clearcoat={1} /></mesh>)}
      {/* sill accent */}
      {[0.9, -0.9].map((z) => <mesh key={z} position={[0, 0.43, z]}><boxGeometry args={[2.0, 0.02, 0.02]} /><meshBasicMaterial color="#8CA3EF" toneMapped={false} /></mesh>)}
    </group>
  );
}
