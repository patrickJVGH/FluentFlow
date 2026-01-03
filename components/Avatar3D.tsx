
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

interface AvatarProps {
  isSpeaking: boolean;
  isRecording?: boolean;
  audioAnalyser?: AnalyserNode | null;
}

const EveModel = ({ isSpeaking, audioAnalyser }: AvatarProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  
  const dataArray = useMemo(() => new Uint8Array(128), []);
  const [blink, setBlink] = useState(false);

  // Smooth transition values
  const mouthScaleRef = useRef(0.1);
  const eyeIntensityRef = useRef(1.5);

  useEffect(() => {
    const blinkLoop = () => {
      const timeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 120);
        blinkLoop();
      }, 3000 + Math.random() * 4000);
      return () => clearTimeout(timeout);
    };
    blinkLoop();
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    let volume = 0;

    if (isSpeaking && audioAnalyser) {
      audioAnalyser.getByteFrequencyData(dataArray);
      // Calculate average volume from low-mid frequencies (better for speech sync)
      let sum = 0;
      const range = 20; 
      for (let i = 0; i < range; i++) sum += dataArray[i];
      volume = sum / range / 255;
    }

    // --- Animation Enhancements for Fluidity & Sync ---
    const lerpFactor = 0.45; // Increased for faster reaction

    // Smoothly interpolate mouth scale
    const targetMouthScale = volume * 3.5 + 0.05; // Increased range, smaller closed state
    mouthScaleRef.current = THREE.MathUtils.lerp(mouthScaleRef.current, targetMouthScale, lerpFactor);

    if (mouthRef.current) {
      // Robot-style digital mouth: changes height and width slightly
      mouthRef.current.scale.y = mouthScaleRef.current;
      mouthRef.current.scale.x = 1 + volume * 0.5;
      // @ts-ignore
      mouthRef.current.material.emissiveIntensity = 1 + volume * 5;
    }

    // Expressive Eyes with faster response
    const targetIntensity = 1.5 + volume * 5;
    eyeIntensityRef.current = THREE.MathUtils.lerp(eyeIntensityRef.current, targetIntensity, lerpFactor - 0.05);

    if (leftEyeRef.current && rightEyeRef.current) {
      const eyeYScale = blink ? 0.05 : 1 + volume * 0.5;
      leftEyeRef.current.scale.y = eyeYScale;
      rightEyeRef.current.scale.y = eyeYScale;
      
      // Update glow
      // @ts-ignore
      leftEyeRef.current.material.emissiveIntensity = eyeIntensityRef.current;
      // @ts-ignore
      rightEyeRef.current.material.emissiveIntensity = eyeIntensityRef.current;
    }

    // Subtle head tilt and bobbing synced with speech
    if (headRef.current) {
      headRef.current.rotation.z = Math.sin(t * 1.5) * 0.02 + (volume * 0.1);
      headRef.current.rotation.x = Math.cos(t * 0.5) * 0.05 - (volume * 0.05);
      headRef.current.position.y = 0.95 + Math.sin(t * 2) * 0.02;
    }

    // Floating Arms
    if (leftArmRef.current && rightArmRef.current) {
      const armBob = Math.sin(t * 2.5) * 0.03 + (volume * 0.05);
      leftArmRef.current.position.y = -0.3 + armBob;
      rightArmRef.current.position.y = -0.3 + armBob;
      leftArmRef.current.rotation.z = 0.15 + Math.sin(t * 1.5) * 0.05 + (volume * 0.1);
      rightArmRef.current.rotation.z = -0.15 - Math.sin(t * 1.5) * 0.05 - (volume * 0.1);
    }
  });

  return (
    <group ref={groupRef}>
      {/* HEAD */}
      <group ref={headRef} position={[0, 0.95, 0]}>
        <mesh>
          <sphereGeometry args={[0.9, 40, 40]} />
          <meshPhysicalMaterial color="white" roughness={0.05} metalness={0.1} clearcoat={1} clearcoatRoughness={0.1} />
        </mesh>
        
        {/* Face Display Area */}
        <mesh position={[0, 0.02, 0.38]} rotation={[-0.1, 0, 0]}>
          <sphereGeometry args={[0.8, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2.1]} />
          <meshBasicMaterial color="#050505" />
        </mesh>

        {/* Face Elements */}
        <group position={[0, 0, 0.85]}>
          {/* Eyes */}
          <mesh ref={leftEyeRef} position={[-0.3, 0.08, 0]}>
            <capsuleGeometry args={[0.08, 0.12, 8, 16]} />
            <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={2} />
          </mesh>
          <mesh ref={rightEyeRef} position={[0.3, 0.08, 0]}>
            <capsuleGeometry args={[0.08, 0.12, 8, 16]} />
            <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={2} />
          </mesh>

          {/* Digital Mouth */}
          <mesh ref={mouthRef} position={[0, -0.25, -0.05]}>
            <boxGeometry args={[0.3, 0.05, 0.02]} />
            <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={1} transparent opacity={0.9} />
          </mesh>
        </group>
      </group>

      {/* BODY */}
      <mesh position={[0, -0.6, 0]} scale={[0.9, 1.6, 0.9]}>
        <sphereGeometry args={[1, 40, 40]} />
        <meshPhysicalMaterial color="white" roughness={0.05} metalness={0.1} clearcoat={1} />
      </mesh>

      {/* ARMS */}
      <mesh ref={leftArmRef} position={[-1.25, -0.3, 0]} scale={[0.7, 1, 0.2]}>
        <capsuleGeometry args={[0.2, 0.6, 12, 24]} />
        <meshPhysicalMaterial color="white" roughness={0.05} />
      </mesh>
      <mesh ref={rightArmRef} position={[1.25, -0.3, 0]} scale={[0.7, 1, 0.2]}>
        <capsuleGeometry args={[0.2, 0.6, 12, 24]} />
        <meshPhysicalMaterial color="white" roughness={0.05} />
      </mesh>
    </group>
  );
};

export const Avatar3D = React.memo((props: AvatarProps) => (
  <div className="w-full h-full">
    <Canvas camera={{ position: [0, 0, 8], fov: 32 }} dpr={[1, 2]}>
      <ambientLight intensity={1.5} />
      <pointLight position={[5, 5, 5]} intensity={2} />
      <Float speed={2} rotationIntensity={0.1} floatIntensity={0.6}>
        <EveModel {...props} />
      </Float>
    </Canvas>
  </div>
));
