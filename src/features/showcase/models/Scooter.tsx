const BLACK = { color: '#12161F', metalness: 0.4, roughness: 0.45 } as const;

function Wheel({ x }: { x: number }) {
  return (
    <group position={[x, 0.2, 0]}>
      <mesh><torusGeometry args={[0.19, 0.055, 24, 64]} /><meshStandardMaterial color="#07090D" roughness={0.95} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.15, 0.15, 0.07, 40]} /><meshStandardMaterial color="#1B2230" metalness={0.9} roughness={0.3} /></mesh>
    </group>
  );
}

/** Electric scooter: matte black frame, light-blue accent, no brand marks. */
export function Scooter() {
  return (
    <group scale={2.5} position={[0, 0, 0]}>
      <Wheel x={0.62} /><Wheel x={-0.62} />
      <mesh position={[0, 0.27, 0]}><boxGeometry args={[1.05, 0.07, 0.24]} /><meshPhysicalMaterial {...BLACK} clearcoat={0.6} /></mesh>
      <mesh position={[-0.05, 0.215, 0]}><boxGeometry args={[0.6, 0.07, 0.2]} /><meshStandardMaterial color="#0A0C12" roughness={0.6} /></mesh>
      <mesh position={[0, 0.305, 0]}><boxGeometry args={[1.0, 0.012, 0.2]} /><meshStandardMaterial color="#1D2943" roughness={1} /></mesh>
      <mesh position={[0, 0.24, 0.128]}><boxGeometry args={[0.95, 0.012, 0.012]} /><meshBasicMaterial color="#8CA3EF" toneMapped={false} /></mesh>
      <mesh position={[0, 0.24, -0.128]}><boxGeometry args={[0.95, 0.012, 0.012]} /><meshBasicMaterial color="#8CA3EF" toneMapped={false} /></mesh>
      {/* stem + fork */}
      <mesh position={[0.5, 0.65, 0]} rotation={[0, 0, -0.18]}><cylinderGeometry args={[0.022, 0.022, 0.85, 20]} /><meshStandardMaterial {...BLACK} /></mesh>
      <mesh position={[0.6, 0.22, 0.075]} rotation={[0, 0, -0.18]}><cylinderGeometry args={[0.012, 0.012, 0.42, 14]} /><meshStandardMaterial color="#C9D3EC" metalness={1} roughness={0.25} /></mesh>
      <mesh position={[0.6, 0.22, -0.075]} rotation={[0, 0, -0.18]}><cylinderGeometry args={[0.012, 0.012, 0.42, 14]} /><meshStandardMaterial color="#C9D3EC" metalness={1} roughness={0.25} /></mesh>
      <mesh position={[0.4, 1.075, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.5, 20]} /><meshStandardMaterial {...BLACK} /></mesh>
      {[0.25, -0.25].map((z) => <mesh key={z} position={[0.4, 1.075, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.13, 20]} /><meshStandardMaterial color="#05070A" roughness={0.9} /></mesh>)}
      <mesh position={[0.4, 1.12, 0]}><boxGeometry args={[0.07, 0.025, 0.12]} /><meshBasicMaterial color="#8CA3EF" toneMapped={false} /></mesh>
      {/* lamps */}
      <mesh position={[0.56, 0.5, 0]}><boxGeometry args={[0.03, 0.035, 0.09]} /><meshBasicMaterial color="#EAF2FF" toneMapped={false} /></mesh>
      <mesh position={[-0.52, 0.32, 0]}><boxGeometry args={[0.02, 0.02, 0.18]} /><meshBasicMaterial color="#FF2B3A" toneMapped={false} /></mesh>
    </group>
  );
}
