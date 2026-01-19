
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, ContactShadows, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface AvatarProps {
  isSpeaking: boolean;
  isRecording?: boolean;
  audioAnalyser?: AnalyserNode | null;
}

const EveModel = ({ isSpeaking, isRecording, audioAnalyser }: AvatarProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  
  const dataArray = useMemo(() => new Uint8Array(128), []);
  const [blink, setBlink] = useState(false);
  const eyeIntensityRef = useRef(4);

  useEffect(() => {
    const blinkLoop = () => {
      const timeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 120);
        blinkLoop();
      }, 3000 + Math.random() * 5000);
      return () => clearTimeout(timeout);
    };
    blinkLoop();
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    let volume = 0;

    if (isSpeaking && audioAnalyser) {
      audioAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      const range = 20; 
      for (let i = 0; i < range; i++) sum += dataArray[i];
      volume = sum / range / 255;
    }

    const baseIntensity = isRecording ? 10 : 4.5;
    const targetIntensity = baseIntensity + volume * 15;
    eyeIntensityRef.current = THREE.MathUtils.lerp(eyeIntensityRef.current, targetIntensity, 0.2);

    if (leftEyeRef.current && rightEyeRef.current) {
      const eyeYScale = blink ? 0.05 : 1 + volume * 0.5;
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, eyeYScale, 0.4);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, eyeYScale, 0.4);
      
      const eyeXScale = 1 + volume * 0.2;
      leftEyeRef.current.scale.x = THREE.MathUtils.lerp(leftEyeRef.current.scale.x, eyeXScale, 0.3);
      rightEyeRef.current.scale.x = THREE.MathUtils.lerp(rightEyeRef.current.scale.x, eyeXScale, 0.3);

      const color = isRecording ? new THREE.Color("#FF2052") : new THREE.Color("#00F5FF");
      // @ts-ignore
      leftEyeRef.current.material.emissive.lerp(color, 0.1);
      // @ts-ignore
      rightEyeRef.current.material.emissive.lerp(color, 0.1);
      // @ts-ignore
      leftEyeRef.current.material.emissiveIntensity = eyeIntensityRef.current;
      // @ts-ignore
      rightEyeRef.current.material.emissiveIntensity = eyeIntensityRef.current;
    }

    if (headRef.current) {
      headRef.current.position.y = 1.2 + Math.sin(t * 1.5) * 0.06;
      headRef.current.rotation.y = Math.sin(t * 0.4) * 0.12;
      headRef.current.rotation.x = Math.cos(t * 0.6) * 0.05 + (volume * -0.15);
    }

    if (bodyRef.current) {
      bodyRef.current.position.y = -0.7 + Math.sin(t * 1.2) * 0.04;
    }

    if (leftArmRef.current && rightArmRef.current) {
      const armBob = Math.sin(t * 2) * 0.05 + (volume * 0.2);
      leftArmRef.current.position.y = -0.4 + armBob;
      rightArmRef.current.position.y = -0.4 + armBob;
      leftArmRef.current.rotation.z = 0.25 + Math.sin(t * 0.8) * 0.1;
      rightArmRef.current.rotation.z = -0.25 - Math.sin(t * 0.8) * 0.1;
    }
  });

  return (
    <group ref={groupRef} dispose={null}>
      {/* CABEÇA - Egg Shell */}
      <group ref={headRef}>
        <mesh castShadow scale={[1, 1.05, 1]}>
          <sphereGeometry args={[0.9, 64, 64]} />
          <meshPhysicalMaterial 
            color="#ffffff" 
            roughness={0.03} 
            metalness={0.05} 
            clearcoat={1} 
            clearcoatRoughness={0.01}
          />
        </mesh>
        
        {/* VISOR - A single front face-plate */}
        {/* We use a flattened sphere segment positioned right on the face */}
        <mesh position={[0, 0, 0.4]} scale={[1.4, 0.85, 0.5]}>
          <sphereGeometry args={[0.6, 48, 48]} />
          <meshPhysicalMaterial 
            color="#050505" 
            roughness={0.02}
            metalness={0.9}
            reflectivity={1}
            clearcoat={1}
          />
        </mesh>

        {/* EYES - Inside the black visor area */}
        <group position={[0, 0.04, 0.68]}>
          <mesh ref={leftEyeRef} position={[-0.26, 0, 0]}>
            <sphereGeometry args={[0.12, 32, 32]} />
            <meshStandardMaterial 
              color="#00F5FF" 
              emissive="#00F5FF" 
              emissiveIntensity={4} 
            />
          </mesh>
          <mesh ref={rightEyeRef} position={[0.26, 0, 0]}>
            <sphereGeometry args={[0.12, 32, 32]} />
            <meshStandardMaterial 
              color="#00F5FF" 
              emissive="#00F5FF" 
              emissiveIntensity={4} 
            />
          </mesh>
        </group>
      </group>

      {/* BODY - Tapered Oval Body */}
      <mesh ref={bodyRef} position={[0, -0.7, 0]} scale={[1, 1.85, 1]} castShadow>
        <sphereGeometry args={[0.9, 64, 64]} />
        <meshPhysicalMaterial 
          color="#ffffff" 
          roughness={0.03} 
          metalness={0.02} 
          clearcoat={1}
        />
      </mesh>

      {/* ARMS - Magnetic Floating Fins */}
      <mesh ref={leftArmRef} position={[-1.3, -0.4, 0]} rotation={[0, 0, 0.15]}>
        <capsuleGeometry args={[0.16, 0.55, 12, 24]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.05} clearcoat={1} />
      </mesh>
      <mesh ref={rightArmRef} position={[1.3, -0.4, 0]} rotation={[0, 0, -0.15]}>
        <capsuleGeometry args={[0.16, 0.55, 12, 24]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.05} clearcoat={1} />
      </mesh>
    </group>
  );
};

export const Avatar3D = React.memo((props: AvatarProps) => (
  <div className="w-full h-full relative">
    <Canvas 
      shadows 
      dpr={[1, 2]} 
      gl={{ antialias: true, alpha: true }}
    >
      <PerspectiveCamera makeDefault position={[0, 0.4, 8.2]} fov={24} />
      <ambientLight intensity={0.9} />
      <spotLight position={[10, 20, 10]} angle={0.2} penumbra={1} intensity={6} castShadow />
      <pointLight position={[-10, 5, -10]} intensity={3} color="#4f46e5" />
      <directionalLight position={[0, 5, 10]} intensity={2.5} />
      <Environment preset="city" />
      <Float speed={2} rotationIntensity={0.15} floatIntensity={0.6}>
        <EveModel {...props} />
      </Float>
      <ContactShadows 
        position={[0, -3.2, 0]} 
        opacity={0.35} 
        scale={10} 
        blur={2.5} 
        far={5} 
      />
    </Canvas>
  </div>
));
