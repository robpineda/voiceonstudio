import React, { useRef, useEffect, useState } from 'react';

// Helper function for formatting time with milliseconds
const formatTime = (totalMilliseconds: number): string => {
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(totalMilliseconds % 1000);

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

interface RecordingIndicatorProps {
  stream: MediaStream | null;
  isPreviewing?: boolean; // Add isPreviewing prop
}

const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({ stream, isPreviewing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0); // Store time in milliseconds
  const timerIntervalRef = useRef<number | null>(null); // Use number for requestAnimationFrame ID
  const startTimeRef = useRef<number | null>(null);

  // Timer effect using requestAnimationFrame for smooth updates
  useEffect(() => {
    let frameId: number;

    const updateTimer = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp; // Initialize start time
      }
      const elapsed = timestamp - startTimeRef.current;
      setElapsedTime(elapsed);
      frameId = requestAnimationFrame(updateTimer);
      timerIntervalRef.current = frameId; // Store the frame ID
    };

    // Only run the timer if recording (stream exists and not previewing)
    if (stream && !isPreviewing) {
      setElapsedTime(0);
      startTimeRef.current = performance.now(); // Use high-resolution time
      frameId = requestAnimationFrame(updateTimer);
      timerIntervalRef.current = frameId;
    } else {
      // Clear timer if not recording
      if (timerIntervalRef.current) {
        cancelAnimationFrame(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      startTimeRef.current = null; // Reset start time
      if (!isPreviewing) { // Reset elapsed time if not previewing (e.g., recording stopped)
         // Keep the last time when previewing starts or stops
         // setElapsedTime(0);
      }
    }

    // Cleanup animation frame on component unmount or state change
    return () => {
      if (timerIntervalRef.current) {
        cancelAnimationFrame(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      startTimeRef.current = null; // Clean up start time ref
    };
  }, [stream, isPreviewing]); // Depend on stream presence and preview state

  // Audio visualization effect
  useEffect(() => {
     // Only run visualization if recording (stream exists and not previewing)
    if (!stream || isPreviewing || !canvasRef.current) {
        // Cleanup previous visualization if state changes
         if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
         }
         // Clear canvas if needed
         const canvas = canvasRef.current;
         if(canvas) {
             const ctx = canvas.getContext('2d');
             if(ctx) {
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
             }
         }
        return;
    };


    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize AudioContext only if needed and not already existing/closed
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
       try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            analyserRef.current.smoothingTimeConstant = 0.7;
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current.connect(analyserRef.current);
         } catch (error) {
            console.error("Error initializing AudioContext:", error);
            // Ensure refs are nullified on error
            if (sourceRef.current && analyserRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
               try { sourceRef.current.disconnect(analyserRef.current); } catch(e) {}
            }
             if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
               try { audioContextRef.current.close(); } catch(e) {}
            }
            audioContextRef.current = null;
            analyserRef.current = null;
            sourceRef.current = null;
            return; // Stop if initialization failed
         }
    } else if (analyserRef.current && sourceRef.current && sourceRef.current.mediaStream !== stream) {
        // If stream changed, reconnect
        try {
            sourceRef.current.disconnect();
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current.connect(analyserRef.current);
        } catch(error) {
            console.error("Error reconnecting stream source:", error);
            return;
        }
    }


    if (!analyserRef.current) {
      console.error("AnalyserNode is not initialized.");
      return;
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const lineWidth = canvasWidth / bufferLength;

    const draw = () => {
       // Double-check conditions before drawing
      if (!analyserRef.current || !ctx || !audioContextRef.current || audioContextRef.current.state === 'closed' || isPreviewing || !stream) {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
         // Clear canvas when stopping
         ctx?.clearRect(0, 0, canvasWidth, canvasHeight);
        return;
      }

      animationFrameId.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.lineWidth = 2;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        const lineHeight = (canvasHeight * percent) * 0.8;
        const yTop = (canvasHeight / 2) - (lineHeight / 2);
        const yBottom = (canvasHeight / 2) + (lineHeight / 2);
        const intensity = Math.min(1, 0.2 + percent * 0.8);
        const redValue = Math.floor(185 + (239 - 185) * intensity);
        const greenBlueValue = Math.floor(28 + (68 - 28) * intensity);
        ctx.strokeStyle = `rgb(${redValue}, ${greenBlueValue}, ${greenBlueValue})`;
        ctx.beginPath();
        ctx.moveTo(x + lineWidth / 2, yTop);
        ctx.lineTo(x + lineWidth / 2, yBottom);
        ctx.stroke();
        x += lineWidth;
      }
    };
    draw();

    // Cleanup visualization for this effect iteration
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
       // Don't disconnect source here, might be needed if stream persists but preview toggles
       // Only disconnect if the stream itself is being removed/changed
    };
  }, [stream, isPreviewing]); // Rerun effect if stream or preview state changes

  // Unmount cleanup effect (ensure full cleanup)
  useEffect(() => {
    const currentAudioContext = audioContextRef.current;
    const currentSourceRef = sourceRef.current;
    // Store refs used in cleanup to avoid issues with potential updates during unmount
    return () => {
      console.log("Running RecordingIndicator unmount cleanup");
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (timerIntervalRef.current) {
        cancelAnimationFrame(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // Disconnect source and close context fully on unmount
      if (currentSourceRef && currentAudioContext && currentAudioContext.state !== 'closed') {
        try { currentSourceRef.disconnect(); } catch (e) { console.warn("Error disconnecting source on unmount:", e); }
      }
       if (currentAudioContext && currentAudioContext.state !== 'closed') {
        currentAudioContext.close().catch((e) => console.warn("Error closing AudioContext on unmount:", e));
      }
      // Nullify refs after cleanup
      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      startTimeRef.current = null;
    };
  }, []); // Empty dependency array ensures this runs only once on unmount

  return (
    <div className="my-4 flex flex-col items-center space-y-3 h-[88px]"> {/* Fixed height */}
      {isPreviewing ? (
        // Display Preview State
        <div className="flex flex-col items-center justify-center h-full">
             <div className="flex items-center space-x-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                </span>
                <p className="text-center text-lg font-medium text-sky-400">
                    Previewing...
                </p>
            </div>
        </div>
      ) : stream ? (
         // Display Recording State (Visualizer + Timer)
        <>
          <canvas
            ref={canvasRef}
            width="300"
            height="60"
            className="mx-auto block rounded bg-transparent"
          ></canvas>
          <p className="text-center text-lg font-mono text-red-400 tabular-nums tracking-wider">
            {formatTime(elapsedTime)}
          </p>
        </>
      ) : (
         // Display Idle/Stopped State (Timer at 00:00.000)
         <div className="flex flex-col items-center justify-center h-full">
             <div className="h-[60px] w-[300px] bg-transparent"></div> {/* Placeholder for canvas size */}
            <p className="text-center text-lg font-mono text-gray-500 tabular-nums tracking-wider">
                {formatTime(0)}
            </p>
         </div>
      )}
    </div>
  );
};

export default RecordingIndicator;
