'use client';

import { useState, useRef, useEffect } from 'react';
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
  // Use functional updates for recordedChunks state for reliability
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]); 
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null); // State for audio preview URL
  const [isPreviewing, setIsPreviewing] = useState(false); // State for preview playback status
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null); // Ref for audio player

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clean up previous preview URL if exists
      if (audioPreviewUrl) {
          URL.revokeObjectURL(audioPreviewUrl);
          setAudioPreviewUrl(null);
      }
      setAudioFile(file);
      setAudioPreviewUrl(URL.createObjectURL(file)); // Create URL for uploaded file preview
      setIsPreviewing(false); // Reset preview state
      console.log('File selected:', file.name);
    }
  };

  const handleScriptChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setScriptText(event.target.value);
  };

  const startRecording = async () => {
    // Clean up previous preview URL if exists
    if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
    }
    setAudioFile(null); // Clear previous file/recording
    setIsPreviewing(false); // Ensure preview stops
    setRecordedChunks([]); // Clear any previous chunks

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);
      // Reset chunks explicitly before starting new recording
      setRecordedChunks([]);
      mediaRecorder.current = new MediaRecorder(stream);

      // --- Logging added to ondataavailable ---
      mediaRecorder.current.ondataavailable = (event) => {
        console.log("ondataavailable event fired. Data size:", event.data.size); // <-- Added Log
        if (event.data.size > 0) {
          // Use a functional update to safely access the previous state
          setRecordedChunks((prev) => {
              console.log("Adding chunk. Current chunks length:", prev.length + 1); // <-- Added Log
              return [...prev, event.data];
          });
        } else {
           console.log("Data size is 0, not adding chunk."); // <-- Added Log
        }
      };

      // --- Logging and error handling added to onstop ---
      mediaRecorder.current.onstop = () => {
        // Use functional state updates to get the latest state directly
        // Capture necessary variables from the outer scope that might be needed
        const currentStreamForCleanup = stream; // Capture stream from the startRecording scope

        setRecordedChunks(currentChunks => {
            console.log("onstop event fired. Processing recorded chunks. Chunks count:", currentChunks.length); // <-- Added Log

            if (currentChunks.length === 0) {
                console.warn("onstop fired, but recordedChunks is empty. No audio file/preview will be created."); // <-- Added Warning
                if (currentStreamForCleanup) { // Use captured stream
                    currentStreamForCleanup.getTracks().forEach((track) => track.stop());
                }
                setMediaStream(null);
                setIsRecording(false);
                return []; // Return empty array for setRecordedChunks
            }

            try {
                const audioBlob = new Blob(currentChunks, { type: 'audio/wav' });
                console.log("Audio Blob created, size:", audioBlob.size); // <-- Added Log

                const audioFile = new File([audioBlob], 'recording.wav', {
                  type: 'audio/wav',
                });
                setAudioFile(audioFile); // Set the main audio file state
                console.log("Audio File object created:", audioFile.name); // <-- Added Log

                const url = URL.createObjectURL(audioBlob);
                console.log("Object URL created:", url); // <-- Added Log
                setAudioPreviewUrl(url); // Set the preview URL

                console.log("Cleaning up after successful stop."); // <-- Added Log
                 if (currentStreamForCleanup) { // Use captured stream
                     currentStreamForCleanup.getTracks().forEach((track) => track.stop());
                 }
                setMediaStream(null);
                setIsRecording(false);
                console.log('Recording stopped, file created successfully.'); // <-- Modified Log

            } catch (error) {
                 console.error("Error during onstop processing (Blob/URL creation):", error); // <-- Added Error Log
                  if (currentStreamForCleanup) { // Use captured stream
                     currentStreamForCleanup.getTracks().forEach((track) => track.stop());
                  }
                 setMediaStream(null);
                 setIsRecording(false);
            }
            // Important: Always return an empty array to clear the chunks state
            // regardless of success or failure in processing.
            return [];
        });
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      console.log('Recording started.');
    } catch (error) {
      console.error('Error starting recording:', error);
      // Ensure state is reset if start fails
      setMediaStream(null);
      setIsRecording(false);
      setRecordedChunks([]);
      alert('Could not start recording. Please ensure microphone permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      console.log("Calling mediaRecorder.current.stop()");
      mediaRecorder.current.stop(); // This should trigger the onstop handler defined above
      // The state setting (setIsRecording(false), etc.) is now primarily handled within the onstop handler
    } else {
      console.warn('stopRecording called but recorder state was not "recording". Current state:', mediaRecorder.current?.state);
      // Fallback cleanup if recorder wasn't active or stop was called unexpectedly
      if (mediaStream) {
         console.log("Stopping media stream tracks (fallback).");
         mediaStream.getTracks().forEach(track => track.stop());
         setMediaStream(null);
      }
      // If stop is called when not recording, ensure isRecording state is false
      // and clear any potentially lingering chunks (though onstop should ideally handle this)
      if(isRecording) {
        setIsRecording(false);
      }
      if(recordedChunks.length > 0) {
        console.warn("Clearing recorded chunks in fallback stop.")
        setRecordedChunks([]);
      }
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

  // Cleanup object URL on unmount or when a new URL is generated
  useEffect(() => {
    const currentUrl = audioPreviewUrl;
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
         console.log("Revoked Object URL:", currentUrl);
      }
    };
  }, [audioPreviewUrl]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white p-8">
      <header className="mb-12 text-center">
        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-red-600 mb-4 animate-pulse-slow">
          SpeakUp Studio
        </h1>
        <p className="text-xl text-gray-300">
          Refine your voice recordings.
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
              disabled={isPreviewing} // Disable recording button while previewing
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
             {/* Show Recording Indicator when recording OR previewing */}
            {(isRecording || isPreviewing) && <RecordingIndicator stream={mediaStream} isPreviewing={isPreviewing} />}
          </div>

           {/* Audio Player */}
          {audioPreviewUrl && !isRecording && (
            <div className="mt-4 flex flex-col items-center space-y-2 animate-fade-in">
                <p className="text-lg text-gray-300">Preview Recording:</p>
              <audio
                ref={audioPlayerRef}
                controls
                src={audioPreviewUrl}
                className="w-full max-w-md"
                onPlay={() => setIsPreviewing(true)}
                onPause={() => setIsPreviewing(false)}
                onEnded={() => setIsPreviewing(false)} // Also set previewing to false when audio ends
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          )}


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
                     className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-red-500 hover:bg-gray-700 transition-colors duration-200 ${isPreviewing || isRecording ? 'opacity-50 cursor-not-allowed' : ''}`} >
                <Icons.upload className="mr-2 h-5 w-5 text-gray-400" />
                <span className="text-base text-gray-300">Choose file or drag & drop</span>
                <Input
                  type="file"
                  id="audioUpload"
                  accept="audio/*"
                  className="sr-only" // Hide the default input visually
                  onChange={handleFileChange}
                  disabled={isPreviewing || isRecording} // Disable upload while previewing or recording
                />
              </label>
            </div>
          </div>

          {/* Display selected/recorded file */}
          {audioFile && !isRecording && !audioPreviewUrl && ( // Only show if not recording and no preview URL (initial state after upload)
            <div className="my-4 text-green-400 text-center animate-fade-in">
              Ready to analyze: <span className="font-semibold">{audioFile.name}</span>
            </div>
          )}

           {/* Display status based on state */}
          {audioFile && audioPreviewUrl && !isRecording && (
            <div className="my-4 text-cyan-400 text-center animate-fade-in">
              Recording ready for preview/analysis: <span className="font-semibold">{audioFile.name}</span>
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
              disabled={isRecording || isPreviewing} // Disable textarea while recording or previewing
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
              disabled={!audioFile || isRecording || isPreviewing} // Disable analyze while recording or previewing
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
        audio {
          filter: invert(1) sepia(1) saturate(5) hue-rotate(340deg) brightness(1.1); /* Style audio player controls */
        }

      `}</style>
    </div>
  );
}
