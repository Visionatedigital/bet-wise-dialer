import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { CallSentiment } from '@/utils/RealtimeAI';

import { cn } from '@/lib/utils';

interface ParticleOrbProps {
  sentiment: CallSentiment;
  isActive: boolean;
}

function ParticleField({ sentiment, isActive }: ParticleOrbProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 2000;

  // Generate particle positions in a spherical distribution
  const positions = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const radius = 2;
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Spherical distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = radius * (0.5 + Math.random() * 0.5);
      
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
    }
    
    return positions;
  }, []);

  // Get color based on sentiment
  const getColor = () => {
    switch (sentiment) {
      case 'positive':
        return new THREE.Color('#22C55E'); // green
      case 'negative':
        return new THREE.Color('#F97316'); // orange
      case 'critical':
        return new THREE.Color('#EF4444'); // red
      default:
        return new THREE.Color('#3B82F6'); // blue
    }
  };

  const color = getColor();

  // Animation
  useFrame((state) => {
    if (!pointsRef.current) return;
    
    const time = state.clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    
    // Speed based on active state
    const speed = isActive ? 1.5 : 0.3;
    const pulseIntensity = isActive ? 0.3 : 0.1;
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Original positions
      const x = positions[i3];
      const y = positions[i3 + 1];
      const z = positions[i3 + 2];
      
      // Calculate distance from center
      const distance = Math.sqrt(x * x + y * y + z * z);
      
      // Wave animation
      const wave1 = Math.sin(time * speed + i * 0.01) * pulseIntensity;
      const wave2 = Math.cos(time * speed * 0.7 + i * 0.015) * pulseIntensity * 0.5;
      
      // Apply waves
      const scale = 1 + wave1 + wave2;
      const normalizedX = x / distance;
      const normalizedY = y / distance;
      const normalizedZ = z / distance;
      
      positions[i3] = normalizedX * distance * scale;
      positions[i3 + 1] = normalizedY * distance * scale;
      positions[i3 + 2] = normalizedZ * distance * scale;
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Rotate the entire particle field slowly
    pointsRef.current.rotation.y = time * 0.05 * speed;
    pointsRef.current.rotation.x = Math.sin(time * 0.03) * 0.1;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={color}
        size={isActive ? 0.025 : 0.015}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={isActive ? 0.8 : 0.5}
      />
    </Points>
  );
}

function CoreGlow({ sentiment, isActive }: ParticleOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const getColor = () => {
    switch (sentiment) {
      case 'positive':
        return '#22C55E';
      case 'negative':
        return '#F97316';
      case 'critical':
        return '#EF4444';
      default:
        return '#3B82F6';
    }
  };

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const scale = isActive 
      ? 1 + Math.sin(time * 2) * 0.15
      : 1 + Math.sin(time * 0.5) * 0.05;
    meshRef.current.scale.set(scale, scale, scale);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshBasicMaterial
        color={getColor()}
        transparent
        opacity={isActive ? 0.3 : 0.1}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function ParticleOrb({ sentiment, isActive }: ParticleOrbProps) {
  const getSentimentLabel = () => {
    switch (sentiment) {
      case 'positive':
        return 'Positive Engagement';
      case 'negative':
        return 'Needs Attention';
      case 'critical':
        return 'Critical - Adjust Approach';
      default:
        return 'Listening...';
    }
  };
  
  const getSentimentColor = () => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-500';
      case 'negative':
        return 'text-orange-500';
      case 'critical':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className={cn(
        "w-full h-[350px] transition-all duration-700",
        !isActive && "opacity-60"
      )}>
        <Canvas
          camera={{ position: [0, 0, 6], fov: 50 }}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <CoreGlow sentiment={sentiment} isActive={isActive} />
          <ParticleField sentiment={sentiment} isActive={isActive} />
        </Canvas>
      </div>
      <div className="mt-2 text-center">
        {isActive ? (
          <>
            <p className={cn("font-medium text-lg", getSentimentColor())}>
              {getSentimentLabel()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Real-time AI sentiment analysis
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Waiting for call...
          </p>
        )}
      </div>
    </div>
  );
}
