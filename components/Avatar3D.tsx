
import React, { useEffect, useState, useRef } from 'react';

interface AvatarProps {
  isSpeaking: boolean;
  isRecording?: boolean;
  audioAnalyser?: AnalyserNode | null;
}

export const Avatar3D: React.FC<AvatarProps> = ({ isSpeaking, isRecording, audioAnalyser }) => {
  const [pulseScale, setPulseScale] = useState(1);
  const [blink, setBlink] = useState(false);
  const requestRef = useRef<number | null>(null);
  const pulseVelocity = useRef(0);

  // Ciclo de piscar
  useEffect(() => {
    let timeout: any;
    const blinkLoop = () => {
      timeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 150);
        blinkLoop();
      }, 3000 + Math.random() * 4000);
    };
    blinkLoop();
    return () => clearTimeout(timeout);
  }, []);

  // Animação reativa ao áudio (Eyes + Mouth)
  useEffect(() => {
    if (!audioAnalyser) return;
    const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    
    const animate = () => {
      let targetScale = 1;
      
      if (isSpeaking) {
        audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        // Analisando frequências médias para melhor resposta labial
        const binsToAnalyze = 15; 
        for (let i = 0; i < binsToAnalyze; i++) sum += dataArray[i];
        const average = sum / binsToAnalyze;
        targetScale = 1 + (average / 140) * 0.8;
      }

      // Spring physics simplificada para animação fluida
      const stiffness = 0.2;
      const damping = 0.7;
      const force = (targetScale - pulseScale) * stiffness;
      pulseVelocity.current = (pulseVelocity.current + force) * damping;
      setPulseScale(prev => prev + pulseVelocity.current);

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isSpeaking, audioAnalyser, pulseScale]);

  const mainColor = isRecording ? "#FF4757" : "#00F5FF";
  const softColor = isRecording ? "rgba(255, 71, 87, 0.25)" : "rgba(0, 245, 255, 0.25)";

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-visible select-none pointer-events-none p-4 sm:p-8">
      <svg 
        viewBox="0 0 400 500" 
        preserveAspectRatio="xMidYMid meet"
        className="max-h-full max-w-full drop-shadow-2xl overflow-visible"
        style={{ 
          animation: 'eve-float 5s ease-in-out infinite',
          willChange: 'transform'
        }}
      >
        <defs>
          <filter id="eve-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F1F5F9" />
          </linearGradient>

          <style>
            {`
              @keyframes eve-float {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                33% { transform: translateY(-10px) rotate(1deg); }
                66% { transform: translateY(-5px) rotate(-1deg); }
              }
              .eve-spring { transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            `}
          </style>
        </defs>

        {/* BRAÇOS */}
        <g opacity="0.8">
          <path d="M70,230 Q50,230 55,290 Q60,350 80,350 Q100,350 95,290 Q90,230 70,230" fill="white" stroke="#E2E8F0" strokeWidth="1" />
          <path d="M330,230 Q350,230 345,290 Q340,350 320,350 Q300,350 305,290 Q310,230 330,230" fill="white" stroke="#E2E8F0" strokeWidth="1" />
        </g>

        {/* CORPO */}
        <path d="M200,190 C130,190 115,280 135,400 C150,470 200,490 200,490 C200,490 250,470 265,400 C285,280 270,190 200,190" fill="url(#bodyGrad)" stroke="#E2E8F0" strokeWidth="1" />

        {/* PEITO / NÚCLEO REATIVO */}
        <g transform="translate(200, 310)">
          <circle r="20" fill="white" stroke="#E2E8F0" strokeWidth="0.5" />
          <circle r={12 * (0.9 + (pulseScale-1)*0.2)} fill={mainColor} filter="url(#eve-glow)" opacity={0.8} />
          <circle r={25 * pulseScale} fill={softColor} />
        </g>

        {/* CABEÇA */}
        <g transform={`translate(0, ${isSpeaking ? (pulseScale - 1) * -8 : 0})`}>
          <ellipse cx="200" cy="115" rx="100" ry="85" fill="white" stroke="#E2E8F0" strokeWidth="1.5" />
          
          {/* VISOR */}
          <rect 
            x="115" y="65" width="170" height="95" rx="47" 
            fill="#0F172A" 
            style={{ 
              transformBox: 'fill-box', 
              transformOrigin: 'center',
              transform: `scale(${1 + (pulseScale - 1) * 0.05})` 
            }} 
          />

          {/* OLHOS DINÂMICOS */}
          <g filter="url(#eve-glow)">
            <ellipse 
              cx="165" cy="100" 
              rx={15 + (pulseScale - 1) * 5} 
              ry={blink ? 1 : 12 + (pulseScale - 1) * 8} 
              fill={mainColor} 
              className="eve-spring"
            />
            <ellipse 
              cx="235" cy="100" 
              rx={15 + (pulseScale - 1) * 5} 
              ry={blink ? 1 : 12 + (pulseScale - 1) * 8} 
              fill={mainColor} 
              className="eve-spring"
            />
          </g>

          {/* BOCA ELÁSTICA (REATIVIDADE MÁXIMA) */}
          <path 
            d={`M180,135 Q200,${135 + (pulseScale - 1) * 60} 220,135`} 
            stroke={mainColor} 
            strokeWidth={3 + (pulseScale - 1) * 5} 
            fill="none" 
            strokeLinecap="round"
            filter="url(#eve-glow)"
            style={{ 
              opacity: (isSpeaking || pulseScale > 1.01) ? 1 : 0.15,
              transition: 'opacity 0.2s ease'
            }}
          />
        </g>
      </svg>
    </div>
  );
};
