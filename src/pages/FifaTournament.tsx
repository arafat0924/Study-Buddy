import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

function SoccerBall() {
  const group = useRef<THREE.Group>(null);
  
  useFrame((_state, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.5;
      group.current.rotation.x += delta * 0.2;
    }
  });

  return (
    // @ts-ignore
    <group ref={group} scale={2.5}>
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.01, 1]} />
        <meshBasicMaterial color="#000000" wireframe />
      </mesh>
    {/* @ts-ignore */}
    </group>
  );
}

export default function FifaTournament() {
  return (
    <div className="relative w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#0a174e] overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 8] }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <SoccerBall />
        </Canvas>
      </div>
      
      <div className="relative z-10 bg-black/50 backdrop-blur-md px-12 py-8 rounded-2xl border border-green-500/30 shadow-2xl">
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-wider uppercase">
          Coming Soon
        </h1>
      </div>
    </div>
  );
}
