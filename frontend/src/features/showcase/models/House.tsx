import { useMemo } from 'react';

const Box = ({ p, s, c, m = 0, r = 0.8, e, ei = 0, op, env = 0.9 }: { p: [number, number, number]; s: [number, number, number]; c: string; m?: number; r?: number; e?: string; ei?: number; op?: number; env?: number }) => (
  <mesh position={p} castShadow receiveShadow>
    <boxGeometry args={s} />
    <meshPhysicalMaterial color={c} metalness={m} roughness={r} emissive={e ?? '#000'} emissiveIntensity={ei} transparent={op !== undefined} opacity={op ?? 1} envMapIntensity={env} />
  </mesh>
);

/** Modern two-storey home: pale render ground floor, cantilevered timber-clad upper floor, deep glazing, flat roof, pool. */
export function House() {
  const slats = useMemo(() => Array.from({ length: 33 }, (_, i) => -2.1 + i * 0.13), []);
  const GLASS = '#0A1224';
  return (
    <group scale={0.62} position={[0, 0, 0]}>
      <Box p={[0, 0.06, 0]} s={[8.2, 0.12, 6]} c="#1A2030" r={0.95} />
      <Box p={[-0.4, 0.14, 0.55]} s={[7.2, 0.04, 4.6]} c="#8892A6" r={0.9} />
      {/* ground floor */}
      <Box p={[-0.9, 0.95, -0.4]} s={[4.6, 1.7, 3.4]} c="#E7EBF2" r={0.75} />
      <Box p={[-0.9, 0.95, 1.32]} s={[3.6, 1.3, 0.05]} c={GLASS} m={0} r={0.05} env={0} e="#2B4A78" ei={0.45} />
      <Box p={[-0.9, 0.95, 1.36]} s={[0.04, 1.34, 0.04]} c="#10141C" m={0.6} r={0.3} />
      <Box p={[0.3, 0.95, 1.36]} s={[0.04, 1.34, 0.04]} c="#10141C" m={0.6} r={0.3} />
      <Box p={[-2.1, 0.95, 1.36]} s={[0.04, 1.34, 0.04]} c="#10141C" m={0.6} r={0.3} />
      {/* upper floor: cantilever over the right */}
      <Box p={[0.9, 2.45, -0.4]} s={[5.4, 1.3, 3.0]} c="#E7EBF2" r={0.75} />
      <Box p={[1.3, 2.45, 1.12]} s={[4.2, 1.28, 0.06]} c="#7A573A" r={0.55} />
      {slats.slice(6, 28).map((x) => <Box key={x} p={[x + 1.3 + 0.9, 2.45, 1.16]} s={[0.03, 1.28, 0.05]} c="#5A3F29" r={0.6} />)}
      <Box p={[-0.2, 2.45, 1.16]} s={[2.7, 0.9, 0.05]} c={GLASS} m={0} r={0.05} env={0} e="#2B4A78" ei={0.45} />
      {/* roof slabs */}
      <Box p={[0.9, 3.17, -0.4]} s={[5.8, 0.14, 3.4]} c="#1A2030" r={0.5} m={0.2} />
      <Box p={[-1.1, 1.86, -0.4]} s={[3.0, 0.1, 3.4]} c="#1A2030" r={0.5} m={0.2} />
      <Box p={[3.3, 1.55, 1.1]} s={[0.1, 1.6, 0.1]} c="#10141C" m={0.7} r={0.3} />
      {/* pool */}
      <Box p={[2.0, 0.17, 2.2]} s={[3.0, 0.04, 1.2]} c="#2A6FB8" m={0.1} r={0.08} e="#3A8FE0" ei={0.25} op={0.92} />
      <Box p={[2.0, 0.15, 2.2]} s={[3.2, 0.03, 1.4]} c="#C9D3EC" r={0.7} />
      {/* low garden wall and path */}
      <Box p={[-2.6, 0.35, 2.4]} s={[2.6, 0.4, 0.12]} c="#5A6478" r={0.9} />
      <Box p={[-0.9, 0.16, 2.6]} s={[0.9, 0.03, 1.6]} c="#C9D3EC" r={0.8} />
    </group>
  );
}
