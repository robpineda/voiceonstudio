'use server';
/**
 * @fileOverview Analyzes audio files to identify clean, usable voice acting segments.
 *
 * - analyzeAudioForCleanSegments - A function that handles the audio analysis process.
 * - AnalyzeAudioForCleanSegmentsInput - The input type for the analyzeAudioForCleanSegments function.
 * - AnalyzeAudioForCleanSegmentsOutput - The return type for the analyzeAudioForCleanSegments function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AnalyzeAudioForCleanSegmentsInputSchema = z.object({
  audioUrl: z.string().describe('The URL of the audio file to analyze.'),
});
export type AnalyzeAudioForCleanSegmentsInput = z.infer<
  typeof AnalyzeAudioForCleanSegmentsInputSchema
>;

const AnalyzeAudioForCleanSegmentsOutputSchema = z.object({
  segments: z
    .array(
      z.object({
        start: z.number().describe('The start time of the clean segment in seconds.'),
        end: z.number().describe('The end time of the clean segment in seconds.'),
        confidence: z
          .number()
          .describe('The confidence score of the segment being clean (0-1).'),
      })
    )
    .describe('An array of clean audio segments with start, end times, and confidence scores.'),
});
export type AnalyzeAudioForCleanSegmentsOutput = z.infer<
  typeof AnalyzeAudioForCleanSegmentsOutputSchema
>;

export async function analyzeAudioForCleanSegments(
  input: AnalyzeAudioForCleanSegmentsInput
): Promise<AnalyzeAudioForCleanSegmentsOutput> {
  return analyzeAudioForCleanSegmentsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeAudioForCleanSegmentsPrompt',
  input: {
    schema: z.object({
      audioUrl: z.string().describe('The URL of the audio file to analyze.'),
    }),
  },
  output: {
    schema: z.object({
      segments: z
        .array(
          z.object({
            start: z
              .number()
              .describe('The start time of the clean segment in seconds.'),
            end: z.number().describe('The end time of the clean segment in seconds.'),
            confidence: z
              .number()
              .describe('The confidence score of the segment being clean (0-1).'),
          })
        )
        .describe(
          'An array of clean audio segments with start, end times, and confidence scores.'
        ),
    }),
  },
  prompt: `You are an AI expert in audio analysis, specifically for identifying clean voice acting segments in an audio file.\n\nAnalyze the audio file at the given URL and identify segments that contain clean, usable voice acting, free of errors, unwanted noises, or pauses. Return the segments with their start and end times in seconds, along with a confidence score (0-1) indicating the likelihood of the segment being clean.\n\nAudio URL: {{audioUrl}}\n\nEnsure the output is a JSON array of segments. Each segment object must include the start time, end time, and confidence score.\n\nExample output:\n{
  "segments": [
    {
      "start": 10.5, //seconds
      "end": 15.2,  //seconds
      "confidence": 0.95
    },
    {
      "start": 25.1, //seconds
      "end": 32.8, //seconds
      "confidence": 0.98
    }
  ]
}`,
});

const analyzeAudioForCleanSegmentsFlow = ai.defineFlow<
  typeof AnalyzeAudioForCleanSegmentsInputSchema,
  typeof AnalyzeAudioForCleanSegmentsOutputSchema
>(
  {
    name: 'analyzeAudioForCleanSegmentsFlow',
    inputSchema: AnalyzeAudioForCleanSegmentsInputSchema,
    outputSchema: AnalyzeAudioForCleanSegmentsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
