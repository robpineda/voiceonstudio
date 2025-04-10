'use client';

import { useState, useRef } from 'react';
import { AudioTimeline } from '@/components/audio-timeline';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { Input } from '@/components/ui/input';
import RecordingIndicator from '@/components/recording-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      console.log('File selected:', file.name);
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
      setMediaStream(stream);
      setAudioFile(null);
      setRecordedChunks([]);
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(recordedChunks, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'recording.wav', {
          type: 'audio/wav',
        });
        setAudioFile(audioFile);
        setRecordedChunks([]);
        stream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);
        setIsRecording(false);
        console.log('Recording stopped, file created.');
      };
      mediaRecorder.current.start();
      setIsRecording(true);
      console.log('Recording started.');
    } catch (error) {
      console.error('Error starting recording:', error);
      setMediaStream(null);
      setIsRecording(false);
      alert('Could not start recording. Please ensure microphone permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
    } else {
      if (mediaStream) {
         mediaStream.getTracks().forEach(track => track.stop());
         setMediaStream(null);
      }
      setIsRecording(false);
      console.log('Stopping recording (fallback).');
    }
  };

  const analyzeAudio = () => {
    if (!audioFile) {
      alert('Please upload or record an audio file first.');
      return;
    }
    console.log('Analyzing audio:', audioFile.name, 'with script:', scriptText ? 'Yes' : 'No');
    // Add analysis logic here
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white p-8">
      <header className="mb-12 text-center">
        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-red-600 mb-4 animate-pulse-slow">
          Voice Polisher
        </h1>
        <p className="text-xl text-gray-300">
          Refine your voice recordings with cutting-edge analysis.
        </p>
      </header>

      <Card className="w-full max-w-2xl bg-gray-800 bg-opacity-70 border-gray-700 shadow-xl backdrop-blur-sm">
        <CardContent className="p-8 space-y-8">

          {/* Record Section */}
          <div className="flex flex-col items-center space-y-4">
            <p className="text-2xl font-semibold text-gray-100">
              Record audio directly
            </p>
            <Button
              size="lg"
              className={`px-8 py-6 text-lg rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${isRecording ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 focus:ring-orange-500'}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? (
                <>
                  <Icons.pause className="mr-2 h-5 w-5 animate-pulse" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Icons.record className="mr-2 h-5 w-5" />
                  Start Recording
                </>
              )}
            </Button>
            {isRecording && <RecordingIndicator stream={mediaStream} />}
          </div>

          {/* OR Separator */}
          <div className="flex items-center justify-center space-x-4">
            <div className="flex-grow border-t border-gray-600"></div>
            <span className="text-xl font-bold text-gray-400">OR</span>
            <div className="flex-grow border-t border-gray-600"></div>
          </div>

          {/* Upload Section - Improved Styling */}
          <div className="flex flex-col items-center space-y-4">
            <p className="text-2xl font-semibold text-gray-100">
              Upload your own audio file
            </p>
            <div className="w-full max-w-md">
              <label htmlFor="audioUpload" 
                     className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-red-500 hover:bg-gray-700 transition-colors duration-200">
                <Icons.upload className="mr-2 h-5 w-5 text-gray-400" />
                <span className="text-base text-gray-300">Choose file or drag & drop</span>
                <Input
                  type="file"
                  id="audioUpload"
                  accept="audio/*"
                  className="sr-only" // Hide the default input visually
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>

          {/* Display selected/recorded file - Removed background box */}
          {audioFile && !isRecording && (
            <div className="my-4 text-green-400 text-center animate-fade-in">
              Ready to analyze: <span className="font-semibold">{audioFile.name}</span>
            </div>
          )}

          {/* Optional Script Input */}
          <div className="w-full space-y-3">
            <label
              htmlFor="scriptText"
              className="block text-lg font-medium text-gray-200 text-center"
            >
              Paste Script (Optional for Accuracy)
            </label>
            <Textarea
              id="scriptText"
              placeholder="Pasting your script here helps the analysis..."
              className="w-full p-4 bg-gray-700 border-gray-600 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 text-base text-gray-100 transition-colors duration-200"
              rows={4}
              onChange={handleScriptChange}
              value={scriptText}
            />
            <p className="text-sm text-gray-400 text-center">
              Comparing audio against a script can improve analysis accuracy.
            </p>
          </div>

          {/* Analyze Button Container */}
          <div className="text-center pt-4">
            <Button
              size="lg"
              className="px-10 py-6 text-xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed disabled:from-gray-500 disabled:to-gray-600"
              onClick={analyzeAudio}
              disabled={!audioFile || isRecording}
            >
              Analyze Audio
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Placeholder for Audio Timeline/Results */}
      <div className="mt-16 w-full max-w-4xl">
        {/* Add placeholder or results display here */}
      </div>

      {/* Basic CSS for animations (can be moved to globals.css) */}
      <style jsx global>{`
        @keyframes pulse-slow {
          50% { opacity: 0.8; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
