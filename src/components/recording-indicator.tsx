'use client';

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
}

const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({ stream }) => {
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

    if (stream) {
      // Start timer when stream is active
      setElapsedTime(0);
      startTimeRef.current = performance.now(); // Use high-resolution time
      frameId = requestAnimationFrame(updateTimer);
      timerIntervalRef.current = frameId;
    } else {
      // Clear timer if stream stops or is null
      if (timerIntervalRef.current) {
        cancelAnimationFrame(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      startTimeRef.current = null; // Reset start time
      // Optionally reset displayed time
      // setElapsedTime(0);
    }

    // Cleanup animation frame on component unmount or stream change
    return () => {
      if (timerIntervalRef.current) {
        cancelAnimationFrame(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      startTimeRef.current = null; // Clean up start time ref
    };
  }, [stream]); // Depend on stream presence

  // Audio visualization effect (remains largely the same)
  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.7;
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
      } catch (error) {
        console.error("Error initializing AudioContext:", error);
        if (sourceRef.current && analyserRef.current) {
           sourceRef.current.disconnect(analyserRef.current);
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(e => console.warn("Error closing AudioContext after init failure:", e));
        }
        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
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
      if (!analyserRef.current || !ctx || !audioContextRef.current || audioContextRef.current.state === 'closed') {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
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

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (sourceRef.current && audioContextRef.current && audioContextRef.current.state !== 'closed') {
         try {
             if (analyserRef.current) {
                 sourceRef.current.disconnect(analyserRef.current);
             } else {
                 sourceRef.current.disconnect();
             }
         } catch (e) {
             console.warn("Error disconnecting source node:", e);
         }
      }
    };
  }, [stream]);

  // Unmount cleanup effect (remains the same)
  useEffect(() => {
    const currentAudioContext = audioContextRef.current;
    const currentSourceRef = sourceRef.current;
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (timerIntervalRef.current) { // Changed from timerIntervalRef.current to check the stored animation frame ID
        cancelAnimationFrame(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (currentSourceRef && currentAudioContext && currentAudioContext.state !== 'closed') {
        try {
          currentSourceRef.disconnect();
        } catch (e) {
          console.warn("Error disconnecting source on unmount:", e);
        }
      }
      if (currentAudioContext && currentAudioContext.state !== 'closed') {
        currentAudioContext.close().catch((e) => console.warn("Error closing AudioContext on unmount:", e));
      }
      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      startTimeRef.current = null; // Clean up start time ref on unmount
    };
  }, []);

  return (
    <div className="my-4 flex flex-col items-center space-y-3">
      <canvas
        ref={canvasRef}
        width="300"
        height="60"
        className="mx-auto block rounded bg-transparent"
      ></canvas>
      {/* Timer Display - update formatTime call */}
      <p className="text-center text-lg font-mono text-red-400 tabular-nums tracking-wider">
        {formatTime(elapsedTime)}
      </p>
    </div>
  );
};

export default RecordingIndicator;
