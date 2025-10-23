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

  // Full script text split into sentences for better highlighting
  const scriptText = `Hello ${leadName || '[Customer Name]'}, this is your agent calling from Betsure Uganda. I hope you're having a great day! I'm calling to share an exclusive offer that's perfect for valued customers like yourself. We have a special welcome bonus available for you today - when you make your first deposit, we'll match it 100% up to UGX 200,000. That means if you deposit UGX 100,000, you'll have UGX 200,000 to bet with! We also offer the best odds in Uganda, instant payouts via Mobile Money, and 24/7 customer support. Would you be interested in taking advantage of this exclusive offer today?`;

  const scriptSentences = scriptText.match(/[^.!?]+[.!?]+/g) || [scriptText];
  const scriptWords = scriptText.split(' ');
  
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

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

    console.log('[LivePitchScript] 📝 Processing transcript:', fullTranscript);

    // Normalize text for comparison
    const normalizeText = (text: string) => 
      text.toLowerCase().replace(/[.,!?;:]/g, '').trim();

    const transcriptNormalized = normalizeText(fullTranscript);
    const scriptNormalized = normalizeText(scriptText);

    // Find how much of the script has been spoken
    let longestMatch = 0;
    let matchedWordCount = 0;
    
    const transcriptWords = transcriptNormalized.split(/\s+/).filter(w => w.length > 0);
    const scriptWordsNormalized = scriptNormalized.split(/\s+/).filter(w => w.length > 0);
    
    // Find the longest matching sequence
    for (let i = 0; i < scriptWordsNormalized.length; i++) {
      let matches = 0;
      for (let j = 0; j < transcriptWords.length && (i + j) < scriptWordsNormalized.length; j++) {
        if (scriptWordsNormalized[i + j] === transcriptWords[j]) {
          matches++;
        }
      }
      if (matches > longestMatch) {
        longestMatch = matches;
        matchedWordCount = i + matches;
      }
    }

    setCurrentWordIndex(matchedWordCount);
    console.log('[LivePitchScript] 📍 Current word index:', matchedWordCount, '/', scriptWords.length);

    // Determine current sentence based on word index
    let wordCount = 0;
    for (let i = 0; i < scriptSentences.length; i++) {
      const sentenceWords = scriptSentences[i].split(' ').filter(w => w.length > 0);
      wordCount += sentenceWords.length;
      if (matchedWordCount < wordCount) {
        setCurrentSentenceIndex(i);
        console.log('[LivePitchScript] 📄 Current sentence:', i, scriptSentences[i]);
        break;
      }
    }

    // Auto-check compliance based on keywords
    const lowerTranscript = fullTranscript.toLowerCase();
    setComplianceChecked(prev => ({
      ...prev,
      introduction: prev.introduction || lowerTranscript.includes('calling from') || lowerTranscript.includes('my name is') || lowerTranscript.includes('this is'),
      dataProtection: prev.dataProtection || lowerTranscript.includes('data protection') || lowerTranscript.includes('privacy'),
      responsibleGaming: prev.responsibleGaming || lowerTranscript.includes('responsible gaming') || lowerTranscript.includes('gamble responsibly'),
      recordingConsent: prev.recordingConsent || lowerTranscript.includes('recording') || lowerTranscript.includes('recorded') || lowerTranscript.includes('call may be')
    }));
  }, [fullTranscript, scriptText, scriptWords, scriptSentences]);

  // Render script with sentence-level highlighting
  const renderHighlightedScript = () => {
    if (isTyping) {
      return (
        <p className="text-sm leading-relaxed">
          {displayedText}
          <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-0.5" />
        </p>
      );
    }

    let wordIndex = 0;
    return (
      <div className="text-sm leading-relaxed space-y-3">
        {scriptSentences.map((sentence, sentenceIdx) => {
          const sentenceWords = sentence.split(' ').filter(w => w.length > 0);
          const isCurrentSentence = sentenceIdx === currentSentenceIndex;
          const isPastSentence = sentenceIdx < currentSentenceIndex;
          const startWordIndex = wordIndex;
          wordIndex += sentenceWords.length;
          
          return (
            <div
              key={sentenceIdx}
              className={`transition-all duration-500 ease-out ${
                isCurrentSentence
                  ? 'scale-105 origin-left'
                  : 'scale-100'
              }`}
            >
              <p className="flex flex-wrap gap-1">
                {sentenceWords.map((word, wordIdx) => {
                  const globalWordIdx = startWordIndex + wordIdx;
                  const isCurrentWord = globalWordIdx === currentWordIndex;
                  const isSpoken = globalWordIdx < currentWordIndex;
                  
                  return (
                    <span
                      key={wordIdx}
                      className={`inline-block transition-all duration-300 ease-out ${
                        isCurrentWord 
                          ? 'text-[#32CD32] font-semibold scale-[1.3] backdrop-blur-sm bg-gradient-to-br from-[#32CD32]/10 via-transparent to-[#32CD32]/5 px-2 py-1 rounded-lg border border-[#32CD32]/30 shadow-[0_0_20px_rgba(50,205,50,0.3),inset_0_0_10px_rgba(50,205,50,0.1)] origin-center' 
                          : isSpoken 
                            ? 'text-muted-foreground/60' 
                            : isCurrentSentence
                              ? 'text-foreground font-medium'
                              : isPastSentence
                                ? 'text-muted-foreground/40'
                                : 'text-foreground/80'
                      }`}
                      style={{
                        transformOrigin: 'center',
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>
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
