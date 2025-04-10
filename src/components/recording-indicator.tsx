'use client';

import React, { useRef, useEffect, useState } from 'react';

// Helper function for formatting time
const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

interface RecordingIndicatorProps {
  stream: MediaStream | null;
}

const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect
  useEffect(() => {
    if (stream) {
      // Start timer when stream is active
      setElapsedTime(0); // Reset timer
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      // Clear timer if stream stops or is null
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // Optionally reset time when stream explicitly becomes null
      // setElapsedTime(0);
    }

    // Cleanup interval on component unmount or stream change
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [stream]); // Depend on stream presence

  // Audio visualization effect
  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize Web Audio API
    if (!audioContextRef.current) {
      try {
        // Use `new` keyword for constructor
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        // Configure analyser
        analyserRef.current.fftSize = 256; // Smaller size for fewer, thicker lines or faster processing
        analyserRef.current.smoothingTimeConstant = 0.7; // Adjust smoothing

        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
      } catch (error) {
        console.error("Error initializing AudioContext:", error);
        // Ensure refs that might have been partially set are cleared if init fails midway
        if (sourceRef.current && analyserRef.current) {
           sourceRef.current.disconnect(analyserRef.current);
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(e => console.warn("Error closing AudioContext after init failure:", e));
        }
        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
        return; // Stop execution if audio context fails
      }
    }

    // *** Add the guard clause here ***
    if (!analyserRef.current) {
      console.error("AnalyserNode is not initialized.");
      return; // Exit the effect if analyserRef is null (e.g., due to init error)
    }

    // Now TypeScript knows analyserRef.current is not null
    const bufferLength = analyserRef.current.frequencyBinCount; // Number of data points
    const dataArray = new Uint8Array(bufferLength);
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const lineWidth = canvasWidth / bufferLength; // Adjust line width based on bufferLength

    const draw = () => {
      // The check inside draw is still important for ongoing animation frames
      if (!analyserRef.current || !ctx || !audioContextRef.current || audioContextRef.current.state === 'closed') {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null; // Clear ID when stopping
        return;
      }

      animationFrameId.current = requestAnimationFrame(draw);

      analyserRef.current.getByteFrequencyData(dataArray); // Fill dataArray with frequency data

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Set line properties
      ctx.lineWidth = 2; // Thin lines

      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        // Make the lines flow from the center, adjust multiplier for sensitivity
        const lineHeight = (canvasHeight * percent) * 0.8;
        const yTop = (canvasHeight / 2) - (lineHeight / 2);
        const yBottom = (canvasHeight / 2) + (lineHeight / 2);

        // Create a gradient or use intensity for color
        // Base red: rgb(239, 68, 68) -> theme.colors.red[500]
        // Darker red: rgb(185, 28, 28) -> theme.colors.red[700]
        const intensity = Math.min(1, 0.2 + percent * 0.8); // Ensure intensity starts from 0.2
        const redValue = Math.floor(185 + (239 - 185) * intensity);
        const greenBlueValue = Math.floor(28 + (68 - 28) * intensity);
        ctx.strokeStyle = `rgb(${redValue}, ${greenBlueValue}, ${greenBlueValue})`;

        // Draw the line
        ctx.beginPath();
        ctx.moveTo(x + lineWidth / 2, yTop); // Center line within its segment
        ctx.lineTo(x + lineWidth / 2, yBottom);
        ctx.stroke();

        x += lineWidth;
      }
    };

    // Start drawing if analyser is ready
    draw();

    // Cleanup audio nodes and animation frame for *this effect run*
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      // Disconnect source when the stream changes or component unmounts (handled by this effect's cleanup)
      // Check if source and context still exist and context is open before disconnecting
      if (sourceRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
         try {
             // Check if analyserRef is also still valid before disconnecting from it
             if (analyserRef.current) {
                 sourceRef.current.disconnect(analyserRef.current);
             } else {
                 // Fallback: disconnect all if analyserRef is somehow null
                 sourceRef.current.disconnect();
             }
         } catch (e) {
             console.warn("Error disconnecting source node:", e);
         }
         // Don't null out sourceRef here if context might be reused; handled in unmount effect
      }
      // Don't close the audio context here if it might be reused across stream changes.
      // The unmount effect handles the final closure.
    };
  }, [stream]); // Re-run effect if the stream changes

  // Effect to close the AudioContext *only* when the component unmounts
   useEffect(() => {
      const currentAudioContext = audioContextRef.current; // Capture the context instance
      const currentSourceRef = sourceRef.current; // Capture source ref if needed for final cleanup

      return () => {
          // Cancel any pending animation frame from the *last* run
          if (animationFrameId.current) {
              cancelAnimationFrame(animationFrameId.current);
              animationFrameId.current = null;
          }
          // Clear timer interval if it's still running
          if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
          }

          // Disconnect source node fully before closing context
          if (currentSourceRef && currentAudioContext && currentAudioContext.state !== 'closed') {
              try {
                  currentSourceRef.disconnect();
              } catch(e) {
                  console.warn("Error disconnecting source on unmount:", e);
              }
          }

          // Close the audio context
          if (currentAudioContext && currentAudioContext.state !== 'closed') {
              currentAudioContext.close().catch(e => console.warn("Error closing AudioContext on unmount:", e));
          }

          // Clear refs on unmount
          audioContextRef.current = null;
          analyserRef.current = null;
          sourceRef.current = null;
      };
  }, []); // Empty dependency array ensures this runs only on mount and unmount


  return (
    <div className="my-4 flex flex-col items-center space-y-3">
      {/* Modern Canvas Visualization */}
      <canvas
        ref={canvasRef}
        width="300" // Keep width reasonable
        height="60" // Adjust height for line flow appearance
        className="mx-auto block rounded bg-transparent"
      ></canvas>

      {/* Timer Display */}
      <p className="text-center text-lg font-mono text-red-400 tabular-nums tracking-wider">
        {formatTime(elapsedTime)}
      </p>
    </div>
  );
};

export default RecordingIndicator;