'use client';

import { useState, useRef } from 'react';
import { AudioTimeline } from '@/components/audio-timeline';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { Input } from '@/components/ui/input';
import RecordingIndicator from '@/components/recording-indicator'; // Import the new component

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null); // State for the stream
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleScriptChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setScriptText(event.target.value);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream); // Store the stream
      setAudioFile(null); // Clear previous recording/upload
      setRecordedChunks([]); // Clear previous chunks
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (event) => {
        console.log('ondataavailable:', event.data, 'size:', event.data.size);
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };
      mediaRecorder.current.onstop = () => {
        console.log('onstop: recordedChunks before Blob:', recordedChunks);
        const audioBlob = new Blob(recordedChunks, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'recording.wav', {
          type: 'audio/wav',
        });
        setAudioFile(audioFile);
        setRecordedChunks([]);
        // Stop tracks and clear stream *after* blob is created
        stream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);
        setIsRecording(false);
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setMediaStream(null); // Ensure stream is null on error
      setIsRecording(false); // Ensure recording state is false
      // Consider adding user feedback here, e.g., using a toast notification
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop(); // This triggers the onstop handler where cleanup happens
    }
    // Redundant cleanup in case onstop doesn't fire, though it should
    if (mediaStream) {
       mediaStream.getTracks().forEach(track => track.stop());
       setMediaStream(null);
    }
    setIsRecording(false);
  };

  const analyzeAudio = () => {
    if (!audioFile) {
      // Consider using a more user-friendly notification system (e.g., toast)
      alert('Please upload or record an audio file first.');
      return;
    }
    // Placeholder for analyze audio function
    console.log('Analyzing audio:', audioFile, 'with script:', scriptText);
    // Add logic to show analysis results or loading state
  };

  return (
    // Main container: Full height, centered content, light gray background
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-8 text-center">
      {/* Header Section */}
      <header className="mb-16">
        <h1 className="text-5xl font-bold text-blue-900 mb-3">
          Voice Polisher
        </h1>
        <p className="text-xl text-gray-600">
          Analyze and polish your voice recordings effortlessly.
        </p>
      </header>

      {/* Main Interaction Area */}
      <main className="w-full max-w-4xl">
        {/* Grid for Record/Upload Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center mb-12">
          {/* Record Section */}
          <div className="flex flex-col items-center md:items-end space-y-4">
            <p className="text-2xl font-medium text-gray-700">
              Record your own audio now
            </p>
            <Button
              size="lg" // Make button larger
              className="px-8 py-6 text-lg bg-teal-500 hover:bg-teal-600 text-white rounded-lg shadow-md transition-transform transform hover:scale-105" // Custom styles: teal accent, larger padding/text, shadow, hover effect
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <>
                  <Icons.pause className="mr-2 h-5 w-5" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Icons.record className="mr-2 h-5 w-5" />
                  Record
                </>
              )}
            </Button>
          </div>

          {/* OR Separator */}
          <div className="flex justify-center">
            <p className="text-3xl font-bold text-gray-400">OR</p>
          </div>

          {/* Upload Section */}
          <div className="flex flex-col items-center md:items-start space-y-4">
            <p className="text-2xl font-medium text-gray-700">
              Upload your own audio
            </p>
            {/* Style the input wrapper for better layout */}
            <div className="w-full max-w-xs">
              <Input
                type="file"
                id="audioUpload"
                className="w-full text-base text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-100 file:text-teal-700 hover:file:bg-teal-200 cursor-pointer" // Tailwind classes for styling the file input
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>

        {/* Conditionally render Recording Indicator */}
        {isRecording && <RecordingIndicator stream={mediaStream} />}

        {/* Display selected/recorded file */}
        {audioFile && !isRecording && (
          <div className="my-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
            Selected file: <span className="font-semibold">{audioFile.name}</span>
          </div>
        )}

        {/* Optional Script Input */}
        <div className="w-full max-w-2xl mx-auto mb-12">
          <label
            htmlFor="scriptText"
            className="block text-lg font-medium text-gray-700 mb-2"
          >
            Paste Script (Optional)
          </label>
          <Textarea
            id="scriptText"
            placeholder="Paste your script here to compare against the audio..."
            className="w-full p-4 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base" // Enhanced styling
            rows={4}
            onChange={handleScriptChange}
            value={scriptText}
          />
          <p className="text-sm text-gray-500 mt-2">
            Comparing your audio against a script can improve analysis accuracy.
          </p>
        </div>

        {/* Analyze Button */}
        <Button
          size="lg"
          className="px-10 py-7 text-xl bg-blue-900 hover:bg-blue-800 text-white rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:scale-100" // Custom styles: primary blue, larger padding/text, shadow, hover effect, disabled state
          onClick={analyzeAudio}
          disabled={!audioFile || isRecording} // Disable if no audio file OR currently recording
        >
          Analyze Audio
        </Button>

        {/* Placeholder for Audio Timeline/Results */}
        <div className="mt-16 w-full">
          {/* Conditionally render timeline or results once analysis is done */}
          {/* <AudioTimeline /> */}
          {/* Example: Add a placeholder or loading indicator */}
          {/* {isAnalyzing && <p>Analyzing...</p>} */}
          {/* {analysisResults && <DisplayResults results={analysisResults} />} */}
        </div>
      </main>

      {/* Footer (Optional) */}
      {/* <footer className="mt-16 text-gray-500 text-sm">
        Footer content here
      </footer> */}
    </div>
  );
}
