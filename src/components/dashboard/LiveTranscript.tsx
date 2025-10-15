import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { TranscriptSegment } from '@/hooks/useLiveTranscription';
import { Mic, User } from 'lucide-react';

interface LiveTranscriptProps {
  transcript: TranscriptSegment[];
  isRecording: boolean;
}

export const LiveTranscript = ({ transcript, isRecording }: LiveTranscriptProps) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Live Transcript</CardTitle>
          {isRecording && (
            <Badge variant="default" className="bg-red-500">
              <Mic className="w-3 h-3 mr-1 animate-pulse" />
              Recording
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {transcript.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Mic className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">Start a call to see live transcription</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transcript.map((segment, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    segment.speaker === 'agent' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    segment.speaker === 'agent' 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-secondary/50 text-secondary-foreground'
                  }`}>
                    {segment.speaker === 'agent' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </div>
                  <div className={`flex-1 ${
                    segment.speaker === 'agent' ? 'text-right' : ''
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(segment.timestamp)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {segment.speaker === 'agent' ? 'You' : 'Customer'}
                      </Badge>
                    </div>
                    <p className={`text-sm p-3 rounded-lg ${
                      segment.speaker === 'agent'
                        ? 'bg-primary/10 text-foreground'
                        : 'bg-muted text-foreground'
                    }`}>
                      {segment.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
