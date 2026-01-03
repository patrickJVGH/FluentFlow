
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'light' | 'dark' | 'brand';
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 32, variant = 'brand' }) => {
  const colors = {
    light: "#FFFFFF",
    dark: "#1e293b",
    brand: "#4f46e5"
  };

  const primaryColor = colors[variant];

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 40 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M20 5C11.7157 5 5 10.3726 5 17C5 20.0402 6.4027 22.8123 8.75 24.8453V32.5L15.3125 27.8716C16.8125 28.5916 18.375 29 20 29C28.2843 29 35 23.6274 35 17C35 10.3726 28.2843 5 20 5Z" 
        stroke={primaryColor} 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <circle cx="15" cy="17" r="2" fill={primaryColor} />
      <circle cx="20" cy="17" r="2" fill={primaryColor} />
      <circle cx="25" cy="17" r="2" fill={primaryColor} />
    </svg>
  );
};
