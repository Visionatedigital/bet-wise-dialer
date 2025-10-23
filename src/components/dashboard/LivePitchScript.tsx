import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface LivePitchScriptProps {
  leadName: string;
  campaign: string;
  leadIntent?: string;
  spokenWords?: string[]; // Words that have been spoken by the agent
  isCallActive: boolean;
}

const complianceItems = [
  { key: 'introduction', label: 'Introduced yourself and company' },
  { key: 'dataProtection', label: 'Mentioned data protection policy' },
  { key: 'responsibleGaming', label: 'Discussed responsible gaming' },
  { key: 'recordingConsent', label: 'Obtained call recording consent' }
];

export const LivePitchScript = ({ 
  leadName, 
  campaign, 
  leadIntent,
  spokenWords = [],
  isCallActive 
}: LivePitchScriptProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const scriptRef = useRef<HTMLDivElement>(null);
  const [complianceChecked, setComplianceChecked] = useState({
    introduction: false,
    dataProtection: false,
    responsibleGaming: false,
    recordingConsent: false
  });

  // Full script text
  const scriptText = `Hello ${leadName || '[Customer Name]'}, this is your agent calling from Betsure Uganda. I hope you're having a great day! I'm calling to share an exclusive offer that's perfect for valued customers like yourself. We have a special welcome bonus available for you today - when you make your first deposit, we'll match it 100% up to UGX 200,000. That means if you deposit UGX 100,000, you'll have UGX 200,000 to bet with! We also offer the best odds in Uganda, instant payouts via Mobile Money, and 24/7 customer support. Would you be interested in taking advantage of this exclusive offer today?`;

  const scriptWords = scriptText.split(' ');

  // Typewriter effect on initial load
  useEffect(() => {
    if (isCallActive && displayedText === '') {
      setIsTyping(true);
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        if (currentIndex <= scriptText.length) {
          setDisplayedText(scriptText.substring(0, currentIndex));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(typingInterval);
        }
      }, 30); // Adjust speed here (lower = faster)

      return () => clearInterval(typingInterval);
    }
  }, [isCallActive, scriptText]);

  // Track spoken words and highlight current position
  useEffect(() => {
    if (spokenWords.length > 0) {
      // Find the index of the last spoken word in the script
      const lastSpokenWord = spokenWords[spokenWords.length - 1].toLowerCase();
      const wordIndex = scriptWords.findIndex((word, idx) => 
        idx >= currentWordIndex && word.toLowerCase().includes(lastSpokenWord)
      );
      
      if (wordIndex !== -1) {
        setCurrentWordIndex(wordIndex);
      }
    }
  }, [spokenWords, currentWordIndex, scriptWords]);

  // Render script with word-by-word highlighting
  const renderHighlightedScript = () => {
    if (isTyping) {
      return (
        <p className="text-sm leading-relaxed">
          {displayedText}
          <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-0.5" />
        </p>
      );
    }

    return (
      <p className="text-sm leading-relaxed">
        {scriptWords.map((word, idx) => {
          const isCurrentWord = idx === currentWordIndex;
          const isSpoken = idx < currentWordIndex;
          
          return (
            <span
              key={idx}
              className={`transition-all duration-300 ${
                isCurrentWord 
                  ? 'text-[#32CD32] font-bold shadow-[0_0_10px_#32CD32] bg-[#32CD32]/10 px-1 rounded' 
                  : isSpoken 
                    ? 'text-muted-foreground' 
                    : 'text-foreground'
              }`}
            >
              {word}{' '}
            </span>
          );
        })}
      </p>
    );
  };

  const allComplianceChecked = Object.values(complianceChecked).every(v => v);

  return (
    <div className="space-y-4">
      <div className="bg-accent/50 rounded-lg p-4">
        <h4 className="font-medium mb-3 text-base">
          Opening Script - {campaign || 'Default'}
        </h4>
        <div ref={scriptRef} className="mb-3">
          {renderHighlightedScript()}
        </div>
        
        {leadIntent && (
          <div className="bg-primary/10 border border-primary/20 rounded p-2 mt-3">
            <strong className="text-sm">Customer Intent:</strong> 
            <span className="text-sm ml-2">{leadIntent}</span>
          </div>
        )}
      </div>

      {/* Compliance Checklist */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Compliance Checklist
        </Label>
        
        <div className="space-y-2">
          {complianceItems.map((item) => (
            <div key={item.key} className="flex items-center space-x-2">
              <Checkbox
                id={item.key}
                checked={complianceChecked[item.key as keyof typeof complianceChecked]}
                onCheckedChange={(checked) => 
                  setComplianceChecked(prev => ({
                    ...prev,
                    [item.key]: checked as boolean
                  }))
                }
              />
              <Label 
                htmlFor={item.key} 
                className="text-sm cursor-pointer"
              >
                {item.label}
              </Label>
            </div>
          ))}
        </div>
        
        {allComplianceChecked && (
          <Badge className="bg-success text-success-foreground">
            ✓ All compliance items checked
          </Badge>
        )}
      </div>
    </div>
  );
};
