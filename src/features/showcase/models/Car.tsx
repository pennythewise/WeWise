import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const URL = '/models/su7/scene.gltf';
const LENGTH = 5; // matches the other showcase models: car runs along x, nose towards +x, wheels on y=0
const YAW = 0; // model's own forward axis -> +x; adjust if the nose points the wrong way

/**
 * 2024 Xiaomi SU7 Max by Ddiaz Design (https://sketchfab.com/ddiaz-design), CC-BY-NC-SA-4.0.
 * Non-commercial use only; credit is shown on the About page.
 */
export function Car() {
  const { scene } = useGLTF(URL);
  const model = useMemo(() => {
    const m = scene.clone(true);
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const long = Math.max(size.x, size.z);
    const k = LENGTH / long;
    const g = new THREE.Group();
    m.position.set(-c.x, -box.min.y, -c.z);
    const inner = new THREE.Group(); inner.add(m);
    inner.scale.setScalar(k);
    inner.rotation.y = (size.z > size.x ? Math.PI / 2 : 0) + YAW;
    g.add(inner);
    return g;
  }, [scene]);
  return <primitive object={model} />;
}

useGLTF.preload(URL);
