import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface TimedSuggestion {
  type: 'action' | 'compliance' | 'info';
  confidence: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp?: number;
}

interface CallSentimentOrbProps {
  sentiment: 'neutral' | 'positive' | 'negative' | 'critical';
  isActive: boolean;
  suggestions?: TimedSuggestion[];
}

export const CallSentimentOrb = ({ sentiment, isActive, suggestions = [] }: CallSentimentOrbProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorTransitionRef = useRef({ r: 59, g: 130, b: 246 }); // Start with blue
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = 80;
    let frame = 0;
    let animationId: number;
    
    const getTargetSentimentColor = () => {
      switch (sentiment) {
        case 'positive':
          return { r: 34, g: 197, b: 94 }; // green
        case 'negative':
          return { r: 249, g: 115, b: 22 }; // orange
        case 'critical':
          return { r: 239, g: 68, b: 68 }; // red
        default:
          return { r: 59, g: 130, b: 246 }; // blue
      }
    };
    
    // Smooth color interpolation
    const lerpColor = (current: { r: number; g: number; b: number }, target: { r: number; g: number; b: number }, speed: number) => {
      return {
        r: current.r + (target.r - current.r) * speed,
        g: current.g + (target.g - current.g) * speed,
        b: current.b + (target.b - current.b) * speed
      };
    };
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Smoothly transition to target color
      const targetColor = getTargetSentimentColor();
      colorTransitionRef.current = lerpColor(colorTransitionRef.current, targetColor, 0.05);
      const color = colorTransitionRef.current;
      
      const numDots = 150;
      
      // Slower animation when dormant
      const speed = isActive ? 1 : 0.3;
      const opacity = isActive ? 1 : 0.5;
      
      // Draw outer glow
      const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius - 20, centerX, centerY, baseRadius + 40);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.3 * opacity})`);
      gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${0.1 * opacity})`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 40, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw dots in orbital patterns
      for (let i = 0; i < numDots; i++) {
        const angle = (i / numDots) * Math.PI * 2;
        
        // Multiple wave patterns for organic movement
        const wave1 = Math.sin(frame * 0.02 * speed + i * 0.1) * 15;
        const wave2 = Math.cos(frame * 0.03 * speed + i * 0.15) * 10;
        const wave3 = Math.sin(frame * 0.025 * speed + i * 0.08) * 8;
        const radius = baseRadius + wave1 + wave2 + wave3;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        // Sequential animation effect - each dot pulses based on its index and time
        const sequenceOffset = (frame * 0.05 * speed + i * 0.02) % (Math.PI * 2);
        const dotSize = 2 + Math.sin(sequenceOffset) * 1.5;
        const dotOpacity = (0.6 + Math.sin(sequenceOffset) * 0.4) * opacity;
        
        // Draw dot with glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${dotOpacity})`;
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${dotOpacity})`;
        
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw inner orbital rings with dots
      for (let ring = 0; ring < 3; ring++) {
        const ringRadius = baseRadius - (ring + 1) * 20;
        const dotsInRing = 50 - ring * 10;
        
        for (let i = 0; i < dotsInRing; i++) {
          const angle = (i / dotsInRing) * Math.PI * 2;
          const wave = Math.sin(frame * 0.03 * speed + i * 0.12 + ring) * 5;
          const radius = ringRadius + wave;
          
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          const sequenceOffset = (frame * 0.04 * speed + i * 0.03 + ring) % (Math.PI * 2);
          const dotSize = 1.5 + Math.sin(sequenceOffset) * 0.8;
          const dotOpacity = (0.4 + Math.sin(sequenceOffset) * 0.3 - ring * 0.1) * opacity;
          
          ctx.shadowBlur = 5;
          ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${dotOpacity})`;
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${dotOpacity})`;
          
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      frame++;
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [sentiment, isActive]);
  
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
    <div className="flex flex-col items-center w-full">
      {/* Orb Section */}
      <div className="flex flex-col items-center justify-center py-8">
        <div className={cn(
          "relative transition-all duration-700",
          !isActive && "animate-breathing"
        )}>
          <canvas 
            ref={canvasRef} 
            width={300} 
            height={300}
            className="transition-opacity duration-500"
          />
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-muted-foreground text-sm font-medium">Waiting for call...</p>
            </div>
          )}
        </div>
        <div className="mt-4 text-center">
          {isActive ? (
            <>
              <p className={cn("font-medium text-lg transition-colors duration-700", getSentimentColor())}>
                {getSentimentLabel()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Real-time sentiment analysis
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              AI will analyze call sentiment when active
            </p>
          )}
        </div>
      </div>

      {/* Suggestions Section */}
      <div className="w-full mt-4">
        {suggestions.length === 0 && isActive && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Listening for conversation cues...</p>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm px-2">AI Suggestions</h4>
            {suggestions.map((suggestion, index) => {
              const bgColor = 
                suggestion.type === 'action' ? 'bg-primary/10 border-primary/20' :
                suggestion.type === 'compliance' ? 'bg-destructive/10 border-destructive/20' :
                'bg-info/10 border-info/20';
              
              const badgeVariant = 
                suggestion.confidence === 'high' ? 'default' :
                suggestion.confidence === 'medium' ? 'secondary' :
                'outline';

              return (
                <div 
                  key={`${suggestion.timestamp}-${index}`} 
                  className={cn(
                    bgColor,
                    "border rounded-lg p-3 text-sm",
                    "animate-in slide-in-from-top-2 fade-in duration-300"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={badgeVariant} className="text-xs">
                      {suggestion.confidence} confidence
                    </Badge>
                    <span className="font-medium">{suggestion.title}</span>
                  </div>
                  <p className="text-foreground/90">{suggestion.message}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
