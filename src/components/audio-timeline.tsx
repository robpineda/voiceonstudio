'use client'; // Add if needed for client-side rendering/hooks

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CleanSegment } from '@/lib/AudioAnalyzer'; // Assuming CleanSegment is exported from here
import { useEffect, useRef } from 'react';

// Define the props interface
interface AudioTimelineProps {
  audioUrl: string;
  segments: CleanSegment[];
}

export function AudioTimeline({ audioUrl, segments }: AudioTimelineProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Optional: Log props to verify they are received
  useEffect(() => {
    console.log('AudioTimeline received url:', audioUrl);
    console.log('AudioTimeline received segments:', segments);
    // If you have an audio element, you might want to load the new URL
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      // Optionally load the audio: audioRef.current.load();
    }
  }, [audioUrl, segments]);

  return (
    <Card className="bg-gray-800 border-gray-700 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Audio Timeline & Segments</CardTitle>
        <CardDescription className="text-gray-400">
          {segments.length > 0 ? `Found ${segments.length} segments.` : 'No segments found.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Basic Audio Player */}
        {audioUrl && (
            <div className="mb-4">
                <audio ref={audioRef} controls src={audioUrl} className="w-full">
                    Your browser does not support the audio element.
                </audio>
            </div>
        )}

        {/* Placeholder for actual timeline visualization */}
        <div className="h-40 bg-gray-700 rounded-md flex flex-col items-center justify-center text-gray-400 mb-4">
          Timeline Visualization Area
          {/* TODO: Add a visual representation of segments on the timeline */} 
        </div>

        {/* List segments */}
        {segments.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-gray-700 rounded">
            <h4 className="text-lg font-semibold mb-2 sticky top-0 bg-gray-700 py-1">Segments:</h4>
            {segments.map((segment, index) => (
              <div key={index} className="p-2 bg-gray-600 rounded text-sm">
                Segment {index + 1}: {segment.start.toFixed(2)}s - {segment.end.toFixed(2)}s
                {segment.confidence !== undefined && (
                    <span className="ml-2 text-xs text-gray-300">(Confidence: {(segment.confidence * 100).toFixed(1)}%)</span>
                )}
                {/* TODO: Add buttons to play/select segment */} 
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
