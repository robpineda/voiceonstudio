'use client';

import React, { useRef, useEffect } from 'react';

interface RecordingIndicatorProps {
  stream: MediaStream | null;
}

const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize Web Audio API
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256; // Smaller FFT size for performance
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);
    // We don't connect analyser to destination, we just want to visualize

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const barWidth = (canvasWidth / bufferLength) * 1.5; // Make bars slightly wider
    let barHeight;
    let x = 0;

    const draw = () => {
      if (!analyserRef.current || !ctx) return;

      animationFrameId.current = requestAnimationFrame(draw);

      analyserRef.current.getByteFrequencyData(dataArray); // Get frequency data

      ctx.fillStyle = '#f8f9fa'; // Light background, match parent bg potentially
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      x = 0;
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] * (canvasHeight / 256) * 1.2; // Scale height

        // Simple color gradient based on height
        const blueShade = Math.min(200, Math.max(50, Math.floor(barHeight * 1.5)));
        ctx.fillStyle = `rgb(50, 50, ${blueShade + 55})`; // Shades of blue/purple
        ctx.fillRect(x, canvasHeight - barHeight, barWidth, barHeight);

        x += barWidth + 1; // Add spacing between bars
      }
    };

    draw();

    // Cleanup function
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
         // Use a try-catch for compatibility, some older implementations might error
         try {
            audioContextRef.current.close();
         } catch (e) {
            console.warn("Error closing AudioContext:", e);
         }
      }
      // Clear refs
      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };

  }, [stream]); // Re-run effect if the stream changes

  return (
    <div className="my-4 p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
      <p className="text-center text-sm text-gray-600 mb-2">Listening...</p>
      <canvas ref={canvasRef} width="300" height="100" className="mx-auto block"></canvas>
    </div>
  );
};

export default RecordingIndicator;
