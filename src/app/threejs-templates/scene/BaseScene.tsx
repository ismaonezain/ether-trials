'use client';

import { Physics, RigidBody } from '@react-three/rapier';
import { Environment, SoftShadows } from '@react-three/drei';
import { Avatar } from './Avatar';

export default function BaseScene() {
  return (
    <>
      {/* High Quality Shadows */}
      <SoftShadows size={25} samples={10} focus={0} />

      {/* Physics World */}
      <Physics gravity={[0, -15, 0]}>
        
        {/* Player */}
        <Avatar />

        {/* Infinite Physics Floor (Invisible) */}
        <RigidBody type="fixed" friction={2} restitution={0}>
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[2000, 2000]} />
            <meshStandardMaterial color="#151515" /> 
          </mesh>
        </RigidBody>

      </Physics>

      {/* Lighting & Environment */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />
      <Environment preset="city" />
    </>
  );
}
