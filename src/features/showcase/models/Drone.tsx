import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const URL = '/models/dji_air_3/scene.gltf';
const SPAN = 3.2; // longest horizontal side
const HOVER = 0.9; // lifted off the floor so the contact shadow reads as flight

/** "DJI Air 3" by polyman (https://sketchfab.com/Polyman_3D), CC-BY-4.0. Credit is shown on the About page. */
export function Drone() {
  const { scene } = useGLTF(URL);
  const model = useMemo(() => {
    const m = scene.clone(true);
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = SPAN / Math.max(size.x, size.z);
    m.position.set(-c.x, -box.min.y, -c.z);
    const inner = new THREE.Group(); inner.add(m);
    inner.scale.setScalar(k);
    inner.position.y = HOVER;
    const g = new THREE.Group(); g.add(inner);
    return g;
  }, [scene]);
  return <primitive object={model} />;
}

useGLTF.preload(URL);
