import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useSpeechTracking } from '@/hooks/useSpeechTracking';

interface LivePitchScriptProps {
  leadName: string;
  campaign: string;
  leadIntent?: string;
  isCallActive: boolean;
  audioContext?: AudioContext;
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
  isCallActive,
  audioContext
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

  // Initialize speech tracking
  const { fullTranscript, isConnected, sendAudioData } = useSpeechTracking({
    isCallActive,
    onTranscriptUpdate: (transcript) => {
      console.log('[LivePitchScript] Transcript update:', transcript);
    }
  });

  // Setup audio capture when call is active
  useEffect(() => {
    if (!isCallActive || !audioContext) return;

    let mediaStream: MediaStream | null = null;
    let audioSource: MediaStreamAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;

    const setupAudioCapture = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        audioSource = audioContext.createMediaStreamSource(mediaStream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          sendAudioData(inputData.buffer);
        };

        audioSource.connect(processor);
        processor.connect(audioContext.destination);
        
        console.log('[LivePitchScript] Audio capture started');
      } catch (error) {
        console.error('[LivePitchScript] Error setting up audio capture:', error);
      }
    };

    setupAudioCapture();

    return () => {
      if (processor) {
        processor.disconnect();
      }
      if (audioSource) {
        audioSource.disconnect();
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCallActive, audioContext, sendAudioData]);

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
    if (!fullTranscript) return;

    const transcriptWords = fullTranscript.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    let matchedIndex = 0;

    // Match transcript words to script words
    for (let i = 0; i < scriptWords.length; i++) {
      const scriptWord = scriptWords[i].toLowerCase().replace(/[.,!?;:]/g, '');
      const transcriptWord = transcriptWords[matchedIndex]?.replace(/[.,!?;:]/g, '');
      
      if (scriptWord === transcriptWord || scriptWord.includes(transcriptWord)) {
        matchedIndex++;
        setCurrentWordIndex(i + 1); // Next word to speak
      }
      
      if (matchedIndex >= transcriptWords.length) break;
    }

    // Auto-check compliance based on keywords
    const lowerTranscript = fullTranscript.toLowerCase();
    setComplianceChecked(prev => ({
      ...prev,
      introduction: prev.introduction || lowerTranscript.includes('calling from') || lowerTranscript.includes('my name is'),
      dataProtection: prev.dataProtection || lowerTranscript.includes('data protection') || lowerTranscript.includes('privacy'),
      responsibleGaming: prev.responsibleGaming || lowerTranscript.includes('responsible gaming') || lowerTranscript.includes('gamble responsibly'),
      recordingConsent: prev.recordingConsent || lowerTranscript.includes('recording') || lowerTranscript.includes('recorded')
    }));
  }, [fullTranscript, scriptWords]);

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
              className={`inline-block transition-all duration-200 ${
                isCurrentWord 
                  ? 'text-[#32CD32] font-bold scale-125 shadow-[0_0_15px_#32CD32] bg-[#32CD32]/20 px-2 py-0.5 rounded mx-1 animate-pulse' 
                  : isSpoken 
                    ? 'text-muted-foreground opacity-60' 
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
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-base">
            Opening Script - {campaign || 'Default'}
          </h4>
          {isConnected && (
            <Badge variant="outline" className="text-xs">
              🎤 Listening
            </Badge>
          )}
        </div>
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
