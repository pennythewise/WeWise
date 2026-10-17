import { Suspense, useEffect, useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ASSETS, type AssetKind } from '@/mock/assets';
import { Car } from './models/Car';
import { House } from './models/House';
import { Scooter } from './models/Scooter';

const SPACING = 11;
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Studio reflections: a procedural room environment, no network assets. */
function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.03).texture;
    scene.environment = env;
    return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

const MODEL: Record<AssetKind, () => JSX.Element> = { car: Car, house: House, scooter: Scooter };
const SCALE: Record<AssetKind, number> = { car: 1, house: 1, scooter: 1 };

function Rig({ index, drag }: { index: number; drag: MutableRefObject<number> }) {
  const world = useRef<THREE.Group>(null);
  const turn = useRef<(THREE.Group | null)[]>([]);
  useFrame((st, dt) => {
    const still = reduced();
    if (world.current) {
      const target = -index * SPACING + drag.current * 0.012; // content follows the finger, then settles
      world.current.position.x = THREE.MathUtils.damp(world.current.position.x, target, 4.2, dt);
    }
    turn.current.forEach((g, i) => {
      if (!g) return;
      g.visible = Math.abs(i - index) <= 1;
      const active = i === index;
      // turntable: slow rotation on the active asset, 3/4 view otherwise
      const want = still ? -0.65 : -0.65 + Math.sin(st.clock.elapsedTime * 0.22) * 0.55 + (active ? 0 : 0.4);
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, want, 2.2, dt);
    });
    st.camera.lookAt(0, -0.55, 0); // aim below the models so they sit in the upper half, clear of the info card
  });
  return (
    <group ref={world}>
      {ASSETS.map((a, i) => {
        const M = MODEL[a.kind];
        return (
          <group key={a.id} position={[i * SPACING, 0, 0]} scale={SCALE[a.kind]}>
            <group ref={(el) => { turn.current[i] = el; }}><M /></group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[3.55, 3.575, 128]} /><meshBasicMaterial color="#8CA3EF" transparent opacity={0.55} toneMapped={false} /></mesh>
            <ContactShadows position={[0, 0.005, 0]} opacity={0.75} scale={9} blur={2.4} far={3} resolution={512} color="#000000" />
          </group>
        );
      })}
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
      <planeGeometry args={[120, 40]} />
      <MeshReflectorMaterial blur={[260, 80]} resolution={512} mixBlur={1} mixStrength={28} mirror={0.55} roughness={0.95} depthScale={0.6} minDepthThreshold={0.4} maxDepthThreshold={1.3} color="#0A0E17" metalness={0.5} />
    </mesh>
  );
}

/** HMI-style showcase stage: dark studio, glossy floor, rim lights, horizontally paged assets. */
export default function AssetScene({ index, drag }: { index: number; drag: MutableRefObject<number> }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 3.8, 16.5], fov: 40 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
      <color attach="background" args={['#070A12']} />
      <fog attach="fog" args={['#070A12', 18, 40]} />
      <Suspense fallback={null}>
        <Studio />
        <ambientLight intensity={0.15} />
        <spotLight position={[0, 9, 6]} angle={0.55} penumbra={0.9} intensity={90} color="#DCE6FF" />
        <spotLight position={[-8, 3, -4]} angle={0.6} penumbra={1} intensity={60} color="#3A5ECF" />
        <spotLight position={[8, 3, -4]} angle={0.6} penumbra={1} intensity={45} color="#8CA3EF" />
        <Floor />
        <Rig index={index} drag={drag} />
      </Suspense>
    </Canvas>
  );
}
