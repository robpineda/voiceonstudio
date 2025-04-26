'use client';

// Import the updated types/functions
import { analyzeAudio, CleanSegment } from '@/lib/AudioAnalyzer'; // analyzeAudio signature needs to match server action
import { useState, useRef, useEffect } from 'react';
import { AudioTimeline } from '@/components/audio-timeline';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { Input } from '@/components/ui/input';
import RecordingIndicator from '@/components/recording-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Helper function to convert Blob/File to Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // result contains the data as a data: URL. We only need the base64 part.
      const base64String = (reader.result as string)?.split(',')[1];
      if (base64String) {
        resolve(base64String);
      } else {
        reject(new Error("Failed to read blob as base64"));
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(blob); // Reads the blob as a data: URL containing base64
  });
}


export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<CleanSegment[] | null>(null); // State for analysis results
  const [isAnalyzing, setIsAnalyzing] = useState(false); // State for analysis loading

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
      setAudioFile(file);
      setAudioPreviewUrl(URL.createObjectURL(file));
      setIsPreviewing(false);
      setAnalysisResults(null); // Clear previous results on new file
      console.log('File selected:', file.name);
    }
  };

  const handleScriptChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setScriptText(event.target.value);
  };

  const startRecording = async () => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setAudioFile(null);
    setIsPreviewing(false);
    setRecordedChunks([]);
    setAnalysisResults(null); // Clear previous results on new recording

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);
      setRecordedChunks([]);
      mediaRecorder.current = new MediaRecorder(stream);

      mediaRecorder.current.ondataavailable = (event) => {
        console.log("ondataavailable event fired. Data size:", event.data.size);
        if (event.data.size > 0) {
          setRecordedChunks((prev) => {
            console.log("Adding chunk. Current chunks length:", prev.length + 1);
            return [...prev, event.data];
          });
        }
      };

      mediaRecorder.current.onstop = () => {
        const currentStreamForCleanup = stream;
        setRecordedChunks(currentChunks => {
            console.log("onstop event fired. Processing recorded chunks. Chunks count:", currentChunks.length);

            if (currentChunks.length === 0) {
                console.warn("onstop fired, but recordedChunks is empty.");
                if (currentStreamForCleanup) {
                    currentStreamForCleanup.getTracks().forEach((track) => track.stop());
                }
                setMediaStream(null);
                setIsRecording(false);
                return [];
            }

            try {
                // Determine mime type (browser specific, may need refinement)
                const mimeType = mediaRecorder.current?.mimeType || 'audio/wav'; // Default or get from recorder
                const audioBlob = new Blob(currentChunks, { type: mimeType });
                console.log(`Audio Blob created, type: ${mimeType}, size:`, audioBlob.size);

                // Create a File object (needed for base64 conversion later)
                const recordingName = `recording.${mimeType.split('/')[1] || 'wav'}`;
                const audioFile = new File([audioBlob], recordingName, { type: mimeType });
                setAudioFile(audioFile);
                console.log("Audio File object created:", audioFile.name);

                const url = URL.createObjectURL(audioBlob);
                console.log("Object URL created:", url);
                setAudioPreviewUrl(url);

                if (currentStreamForCleanup) {
                     currentStreamForCleanup.getTracks().forEach((track) => track.stop());
                }
                setMediaStream(null);
                setIsRecording(false);
                console.log('Recording stopped, file created successfully.');
            } catch (error) {
                 console.error("Error during onstop processing:", error);
                  if (currentStreamForCleanup) {
                     currentStreamForCleanup.getTracks().forEach((track) => track.stop());
                  }
                 setMediaStream(null);
                 setIsRecording(false);
            }
            return []; // Clear chunks state
        });
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      console.log('Recording started.');
    } catch (error) {
      console.error('Error starting recording:', error);
      setMediaStream(null);
      setIsRecording(false);
      setRecordedChunks([]);
      alert('Could not start recording. Please ensure microphone permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      console.log("Calling mediaRecorder.current.stop()");
      mediaRecorder.current.stop();
    } else {
      console.warn('stopRecording called but recorder state was not \"recording\".');
      if (mediaStream) {
         mediaStream.getTracks().forEach(track => track.stop());
         setMediaStream(null);
      }
      if(isRecording) setIsRecording(false);
      if(recordedChunks.length > 0) setRecordedChunks([]);
    }
  };

  // --- Updated handleAnalyzeAudio ---
  const handleAnalyzeAudio = async () => {
    if (!audioFile) { // Only need audioFile now, not audioPreviewUrl for analysis logic
      alert('Please upload or record an audio file first.');
      return;
    }
    console.log('Starting analysis for:', audioFile.name, 'with script:', scriptText ? 'Yes' : 'No');
    setIsAnalyzing(true);
    setAnalysisResults(null);

    try {
      // 1. Convert the audioFile (Blob) to Base64
      console.log('Converting audio file to Base64...');
      const audioBase64 = await blobToBase64(audioFile);
      console.log(`Conversion complete. Base64 length: ${audioBase64.length}`);

      // 2. Call the server action with base64 data and script
      console.log('Calling analyzeAudio server action...');
      // Pass the base64 string and script directly. The server action `analyzeAudio`
      // defined in AudioAnalyzer.ts should now expect these two arguments.
      const analysisResult = await analyzeAudio(audioBase64, scriptText);
      console.log('Analysis Result received from server:', analysisResult);

      // 3. Update state with the segments found
      if (analysisResult && analysisResult.segments) {
          setAnalysisResults(analysisResult.segments);
      } else {
          setAnalysisResults([]);
          console.warn("Analysis returned no segments.");
      }

    } catch (error) {
       console.error('Error during audio analysis process:', error);
       alert(`Audio analysis failed: ${error instanceof Error ? error.message : String(error)}`);
       setAnalysisResults(null);
    } finally {
        setIsAnalyzing(false);
        console.log('Analysis process finished.');
    }
  };
  // --- End Updated handleAnalyzeAudio ---

  useEffect(() => {
    // Cleanup audioPreviewUrl when component unmounts or url changes
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
              disabled={isPreviewing || isAnalyzing} // Disable while previewing or analyzing
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
            {isRecording && <RecordingIndicator stream={mediaStream} isPreviewing={false} />}
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
                onEnded={() => setIsPreviewing(false)}
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

          {/* Upload Section */}
          <div className="flex flex-col items-center space-y-4">
            <p className="text-2xl font-semibold text-gray-100">
              Upload your own audio file
            </p>
            <div className="w-full max-w-md">
              <label htmlFor="audioUpload"
                     className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-red-500 hover:bg-gray-700 transition-colors duration-200 ${isPreviewing || isRecording || isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`} >
                <Icons.upload className="mr-2 h-5 w-5 text-gray-400" />
                <span className="text-base text-gray-300">Choose file or drag & drop</span>
                <Input
                  type="file"
                  id="audioUpload"
                  accept="audio/*"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={isPreviewing || isRecording || isAnalyzing}
                />
              </label>
            </div>
          </div>

          {/* Display status */}
          {audioFile && audioPreviewUrl && !isRecording && (
            <div className="my-4 text-cyan-400 text-center animate-fade-in">
              Audio ready for preview/analysis: <span className="font-semibold">{audioFile.name}</span>
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
              disabled={isRecording || isPreviewing || isAnalyzing}
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
              onClick={handleAnalyzeAudio}
              disabled={!audioFile || isRecording || isPreviewing || isAnalyzing} // Disable button if no file, recording, previewing or analyzing
            >
                {isAnalyzing ? (
                    <>
                        <Icons.spinner className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing...
                    </>
                ) : (
                    'Analyze Audio'
                )}
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Display Analysis Results/Timeline */}
      {analysisResults && audioPreviewUrl && ( // Keep audioPreviewUrl here for the timeline display
          <div className="mt-16 w-full max-w-4xl">
              <h2 className="text-3xl font-bold text-center text-gray-100 mb-6">Analysis Results</h2>
              {analysisResults.length > 0 ? (
                  <AudioTimeline
                      audioUrl={audioPreviewUrl} // Timeline still needs the URL for playback
                      segments={analysisResults}
                  />
              ) : (
                  <p className="text-center text-gray-400">No suitable segments found in the audio.</p>
              )}
          </div>
      )}
      {isAnalyzing && !analysisResults && ( // Show spinner only while analyzing AND before results are shown
          <div className="mt-16 w-full max-w-4xl text-center text-gray-300">
              <Icons.spinner className="h-8 w-8 animate-spin inline-block mr-2" />
              <p>Analyzing audio, please wait...</p>
          </div>
      )}

      {/* Global styles (can be moved to globals.css) */}
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
          filter: invert(1) sepia(1) saturate(5) hue-rotate(340deg) brightness(1.1);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
