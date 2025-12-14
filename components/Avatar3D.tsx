
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, Float } from '@react-three/drei';
import * as THREE from 'three';

// Add type definitions for R3F elements and HTML elements to appease TypeScript in this environment
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // HTML Elements
      div: any;
      span: any;
      p: any;
      h1: any;
      h2: any;
      h3: any;
      h4: any;
      h5: any;
      h6: any;
      ul: any;
      li: any;
      button: any;
      a: any;
      img: any;
      input: any;
      label: any;
      select: any;
      option: any;
      form: any;
      header: any;
      main: any;
      footer: any;
      nav: any;
      section: any;
      strong: any;
      b: any;
      i: any;
      small: any;
      br: any;
      hr: any;
      canvas: any;
      video: any;
      audio: any;
      table: any;
      thead: any;
      tbody: any;
      tr: any;
      th: any;
      td: any;

      // Three.js Elements (R3F)
      group: any;
      mesh: any;
      meshLambertMaterial: any;
      meshBasicMaterial: any;
      capsuleGeometry: any;
      planeGeometry: any;
      cylinderGeometry: any;
      sphereGeometry: any;
      circleGeometry: any;
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
    }
  }
}

interface AvatarProps {
  isSpeaking: boolean;
  isRecording: boolean;
  audioAnalyser?: AnalyserNode | null;
  disableHeadMotion?: boolean;
}

// --- 3D ROBOT COMPONENT ---
const Robot = ({ isSpeaking, audioAnalyser, disableHeadMotion }: AvatarProps) => {
  const headRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  
  // Audio Data Buffer
  const dataArray = useMemo(() => new Uint8Array(128), []);
  
  // Blinking State
  const [blink, setBlink] = useState(false);

  // Blinking Logic with CLEANUP
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const blinkLoop = () => {
      const nextBlink = 2000 + Math.random() * 4000;
      timeoutId = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
        blinkLoop();
      }, nextBlink);
    };
    blinkLoop();
    return () => clearTimeout(timeoutId);
  }, []);

  // Animation Loop
  useFrame((state) => {
    // 1. Audio Analysis for Mouth
    let targetOpenness = 0.1;
    let targetScaleX = 1;

    if (isSpeaking && audioAnalyser) {
      audioAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      // Sampling a smaller range for performance
      for (let i = 2; i < 10; i++) sum += dataArray[i];
      const average = sum / 8;
      
      if (average > 10) {
        targetOpenness = 0.2 + (average / 255) * 1.5; 
        targetScaleX = 1 + (average / 255) * 0.2;
      }
    } else if (isSpeaking) {
      const time = state.clock.getElapsedTime();
      targetOpenness = 0.3 + Math.sin(time * 15) * 0.2;
    }

    if (mouthRef.current) {
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targetOpenness, 0.2);
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, targetScaleX, 0.1);
    }

    // 2. Eye Blinking
    const targetEyeScaleY = blink ? 0.1 : 1;
    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, targetEyeScaleY, 0.4);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, targetEyeScaleY, 0.4);
    }

    // 3. Simple Head Idle
    if (headRef.current && !disableHeadMotion) {
      const t = state.clock.getElapsedTime();
      headRef.current.rotation.y = Math.sin(t * 0.5) * 0.05; // Reduced range
      headRef.current.rotation.x = Math.sin(t * 0.3) * 0.03;
    } else if (headRef.current && disableHeadMotion) {
      headRef.current.rotation.set(0, 0, 0);
    }
  });

  return (
    <group ref={headRef}>
      {/* --- HEAD SHAPE (Lambert Material = Cheap Lighting, No Reflections) --- */}
      {/* Reduced smoothness to 0 for lower poly count */}
      <RoundedBox args={[2, 1.8, 1.5]} radius={0.4} smoothness={1}>
        <meshLambertMaterial color="#eef2ff" />
      </RoundedBox>

      {/* --- FACE SCREEN (Basic Material = No Lighting calc) --- */}
      <RoundedBox args={[1.7, 1.4, 0.1]} radius={0.2} position={[0, 0, 0.76]} smoothness={1}>
        <meshBasicMaterial color="#111827" />
      </RoundedBox>

      {/* --- EYES --- */}
      <group position={[0, 0.25, 0.82]}>
        <mesh ref={leftEyeRef} position={[-0.4, 0, 0]}>
          <capsuleGeometry args={[0.12, 0.15, 2, 4]} />
          <meshBasicMaterial color="#06b6d4" toneMapped={false} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.4, 0, 0]}>
          <capsuleGeometry args={[0.12, 0.15, 2, 4]} />
          <meshBasicMaterial color="#06b6d4" toneMapped={false} />
        </mesh>
      </group>

      {/* --- MOUTH --- */}
      <group position={[0, -0.35, 0.82]}>
        <mesh ref={mouthRef}>
          <planeGeometry args={[0.6, 0.4]} />
          <meshBasicMaterial color="#06b6d4" toneMapped={false} opacity={0.8} transparent />
        </mesh>
      </group>

      {/* --- HEADPHONES (Simplified) --- */}
      <group position={[1.1, 0, 0]}>
         <RoundedBox args={[0.3, 1, 0.8]} radius={0.1} smoothness={1}>
            <meshLambertMaterial color="#4338ca" />
         </RoundedBox>
      </group>
      <group position={[-1.1, 0, 0]}>
         <RoundedBox args={[0.3, 1, 0.8]} radius={0.1} smoothness={1}>
            <meshLambertMaterial color="#4338ca" />
         </RoundedBox>
      </group>
      
      {/* --- ANTENNA (Simplified Geometry) --- */}
      <group position={[0, 1.1, 0]}>
         <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.4, 6]} />
            <meshBasicMaterial color="#9ca3af" />
         </mesh>
         <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.15, 6, 6]} />
            <meshBasicMaterial color={isSpeaking ? "#4ade80" : "#ef4444"} />
         </mesh>
      </group>
    </group>
  );
};

export const Avatar3D: React.FC<AvatarProps> = (props) => {
  return (
    // Container fits parent exactly
    <div className="w-full h-full relative overflow-visible">
      <Canvas 
        shadows={false} 
        dpr={[0.8, 1]} 
        // CAM UPDATE: Zoomed in closer (Z=4.2) to focus on head. 
        // Position Y=0.2 keeps eyes in upper center third.
        camera={{ position: [0, 0.2, 4.2], fov: 35 }} 
        gl={{ antialias: true, powerPreference: 'default', alpha: true }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 10, 7]} intensity={1} color="#ffffff" />
        <pointLight position={[-5, -5, -5]} intensity={0.4} color="#6366f1" />

        {props.disableHeadMotion ? (
             <Robot {...props} />
        ) : (
            <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.2}>
              <Robot {...props} />
            </Float>
        )}

        {/* Shadow Removed */}

      </Canvas>
      
      {/* Discrete Status Indicator (Internal) */}
      {(props.isSpeaking || props.isRecording) && (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center pointer-events-none z-10">
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase shadow-sm backdrop-blur-sm border ${
                props.isSpeaking 
                ? 'bg-indigo-50/90 text-indigo-600 border-indigo-100' 
                : 'bg-red-50/90 text-red-500 border-red-100 animate-pulse'
            }`}>
                {props.isSpeaking ? 'Falando' : 'Ouvindo'}
            </div>
        </div>
      )}
    </div>
  );
};
