
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Float } from '@react-three/drei';
import * as THREE from 'three';

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
  const { viewport } = useThree();
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  
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

    // 3. Head Motion (Idle vs Interactive)
    if (headRef.current && !disableHeadMotion) {
      const t = state.clock.getElapsedTime();
      
      let targetRotY = 0;
      let targetRotX = 0;
      let lerpSpeed = 0.05; // Default slow idle speed

      if (isDragging) {
        // INTERACTIVE MODE: Follow the pointer
        // state.pointer.x goes from -1 (left) to 1 (right)
        // state.pointer.y goes from -1 (bottom) to 1 (top)
        
        targetRotY = state.pointer.x * 0.9; // Slightly increased range
        targetRotX = -state.pointer.y * 0.6; // Invert Y
        lerpSpeed = 0.25; // Move faster when tracking finger
      } else {
        // IDLE MODE: Gentle sine wave
        targetRotY = Math.sin(t * 0.5) * 0.05;
        targetRotX = Math.sin(t * 0.3) * 0.03;
      }

      // Smoothly interpolate current rotation to target
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetRotY, lerpSpeed);
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetRotX, lerpSpeed);
    } else if (headRef.current && disableHeadMotion) {
      headRef.current.rotation.set(0, 0, 0);
    }
  });

  // Cursor style handler
  const handlePointerDown = (e: any) => { 
    e.stopPropagation(); 
    // Capture pointer on the invisible plane ensures we track drags even outside the robot mesh
    // @ts-ignore
    e.target.setPointerCapture(e.pointerId); 
    setIsDragging(true); 
    document.body.style.cursor = 'grabbing'; 
  };
  const handlePointerUp = (e: any) => { 
    e.stopPropagation();
    // @ts-ignore
    if (e.target.hasPointerCapture(e.pointerId)) {
      // @ts-ignore
      e.target.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false); 
    document.body.style.cursor = 'grab'; 
  };

  return (
    <>
        {/* Invisible Interaction Plane - Covers the entire view to catch touches everywhere */}
        <mesh 
            position={[0, 0, 3]} 
            onPointerDown={handlePointerDown} 
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <planeGeometry args={[viewport.width * 5, viewport.height * 5]} />
            <meshBasicMaterial transparent opacity={0} depthTest={false} />
        </mesh>

        <group ref={headRef}>
            {/* --- HEAD SHAPE --- */}
            <RoundedBox args={[2, 1.8, 1.5]} radius={0.4} smoothness={1}>
                <meshLambertMaterial color={isDragging ? "#e0e7ff" : "#eef2ff"} />
            </RoundedBox>

            {/* --- FACE SCREEN --- */}
            <RoundedBox args={[1.7, 1.4, 0.1]} radius={0.2} position={[0, 0, 0.76]} smoothness={1}>
                <meshBasicMaterial color="#111827" />
            </RoundedBox>

            {/* --- EYES --- */}
            <group position={[0, 0.25, 0.82]}>
                <mesh ref={leftEyeRef} position={[-0.4, 0, 0]}>
                <capsuleGeometry args={[0.12, 0.15, 2, 4]} />
                <meshBasicMaterial color={isDragging ? "#22d3ee" : "#06b6d4"} toneMapped={false} />
                </mesh>
                <mesh ref={rightEyeRef} position={[0.4, 0, 0]}>
                <capsuleGeometry args={[0.12, 0.15, 2, 4]} />
                <meshBasicMaterial color={isDragging ? "#22d3ee" : "#06b6d4"} toneMapped={false} />
                </mesh>
            </group>

            {/* --- MOUTH --- */}
            <mesh ref={mouthRef} position={[0, -0.3, 0.82]}>
                <planeGeometry args={[0.8, 0.2]} />
                <meshBasicMaterial color={isDragging ? "#22d3ee" : "#06b6d4"} toneMapped={false} />
            </mesh>

            {/* --- ANTENNA --- */}
            <group position={[0, 1.1, 0]}>
                <mesh position={[0, 0.1, 0]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.4]} />
                    <meshLambertMaterial color="#9ca3af" />
                </mesh>
                <mesh position={[0, 0.35, 0]}>
                    <sphereGeometry args={[0.15]} />
                    <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} toneMapped={false} />
                </mesh>
            </group>

            {/* --- HEADPHONES / EARS --- */}
            <group>
                <mesh position={[-1.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.4, 0.4, 0.3]} />
                <meshLambertMaterial color="#6366f1" />
                </mesh>
                <mesh position={[1.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.4, 0.4, 0.3]} />
                <meshLambertMaterial color="#6366f1" />
                </mesh>
            </group>
        </group>
    </>
  );
};

export const Avatar3D = React.memo(({ isSpeaking, isRecording, audioAnalyser, disableHeadMotion }: AvatarProps) => {
  return (
    <div className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 40 }} 
        dpr={[1, 2]} 
        gl={{ powerPreference: "high-performance", antialias: true }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <Float 
          speed={2} 
          rotationIntensity={0.2} 
          floatIntensity={0.2}
          floatingRange={[-0.1, 0.1]}
        >
          <Robot 
            isSpeaking={isSpeaking} 
            isRecording={isRecording}
            audioAnalyser={audioAnalyser}
            disableHeadMotion={disableHeadMotion}
          />
        </Float>
      </Canvas>
    </div>
  );
});
