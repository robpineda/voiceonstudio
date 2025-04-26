'use server';

// Import the updated types from the AI flow
import {
  analyzeAudioForCleanSegments,
  AnalyzeAudioForCleanSegmentsInputSchema, // Use schema for validation
  AnalyzeAudioForCleanSegmentsOutput, // Use the specific output type
  SegmentSchema, // Use the exported schema
} from '@/ai/flows/analyze-audio-for-clean-segments';
import { z } from 'zod';
// Remove node-fetch import - no longer needed
// import fetch from 'node-fetch';

// Define CleanSegment based on the AI flow's exported SegmentSchema
type CleanSegment = z.infer<typeof SegmentSchema>; // Contains start, end, confidence

// Remove the fetchBlobUrlAsBase64 helper function - no longer needed

// Keep the class internal to the module
class AudioAnalyzer {
  /**
   * Analyzes the provided audio data (as base64) to identify perfect takes.
   *
   * @param audioBase64 The base64 encoded string of the audio data.
   * @param script Optional script text to compare against.
   * @returns A promise that resolves with the analysis result (containing segments) or throws an error.
   */
  async analyzeInternal(audioBase64: string, script?: string): Promise<AnalyzeAudioForCleanSegmentsOutput> {
    // Input validation now happens on the received base64 string
    if (!audioBase64) {
      throw new Error('Audio data (base64) must be provided.');
    }

    console.log(`Received request to analyze audio (base64 string). Length: ${audioBase64.length}`);
    if (script) {
      console.log('Using provided script for analysis.');
    }

    try {
        // Prepare the input for the updated AI flow using the received base64 data
        const input = { audioBase64, script };

        // Validate input against the updated schema
        const validationResult = AnalyzeAudioForCleanSegmentsInputSchema.safeParse(input);
        if (!validationResult.success) {
            // Log the specific validation error
             console.error("Server-side input validation failed:", validationResult.error.flatten());
             throw new Error(`Invalid input data for analysis flow: ${validationResult.error.message}`);
        }

        // Call the updated AI flow with validated base64 data
        const analysisResult = await analyzeAudioForCleanSegments(validationResult.data);

        console.log('Audio analysis successful:', analysisResult);

        // Return the structured result from the flow
        return analysisResult ?? { segments: [] }; // Return empty segments if result is null/undefined

    } catch (error) {
      // Catch errors from the AI flow itself
      console.error('Error during audio analysis process:', error);
      throw new Error(`Failed to analyze audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extracts the identified perfect take segments from the analysis result.
   * @param analysisResult The result object from the analyzeAudioForCleanSegments flow.
   * @returns An array of CleanSegment objects.
   */
  private extractSegmentsFromResult(analysisResult: AnalyzeAudioForCleanSegmentsOutput | null): CleanSegment[] {
      if (!analysisResult || !analysisResult.segments || !Array.isArray(analysisResult.segments)) {
          console.warn('Invalid or empty analysis result received.');
          return [];
      }
      return analysisResult.segments;
  }


  /**
   * Placeholder for the cropping/stitching logic based on analysis results.
   * This would likely require additional tools or libraries for audio manipulation.
   *
   * @param audioBase64 The base64 encoded audio data.
   * @param segments The clean segments identified by the analyze method.
   * @returns A promise resolving to the URL or Blob of the final processed audio.
   */
  async processAndCombineSegmentsInternal(audioBase64: string, segments: CleanSegment[]): Promise<string | Blob> {
      console.log(`Processing audio (base64 input) with segments:`, segments);

      if (!segments || segments.length === 0) {
          console.warn("No segments provided for processing.");
          throw new Error("Cannot process audio: No clean segments provided.");
      }
      if (!audioBase64) {
          throw new Error("Audio data (base64) must be provided for processing.");
      }

      // Sort segments by start time just in case the AI didn't
      segments.sort((a, b) => a.start - b.start);

      // TODO: Implement actual audio processing logic here using tools like ffmpeg.
      // Steps:
      // 1. Decode base64 audio data to a buffer.
      // 2. Use ffmpeg (server-side) with the buffer as input:
      //    a. Extract each segment: `ffmpeg -i input.wav -ss {start} -to {end} -c copy output_segment_{n}.wav` (using buffer input)
      //    b. Create a list file (mylist.txt) for concatenation: `file 'output_segment_0.wav'`
      //    c. Concatenate: `ffmpeg -f concat -safe 0 -i mylist.txt -c copy final_output.wav`
      // 3. Return the final audio Blob or URL (maybe as base64 again?).

      console.error('Audio segment processing (cropping and stitching) is not implemented yet.');
      throw new Error('Audio segment processing not implemented yet.');

      // Placeholder:
      // const processedAudioBlob = new Blob(); // Replace with actual result
      // return processedAudioBlob;
  }


  /**
   * Combines analysis and processing (cropping/stitching).
   * Identifies perfect takes and (eventually) combines them.
   * Note: The cropping/stitching part (processAndCombineSegments) is not yet implemented.
   *
   * @param audioBase64 The base64 encoded string of the audio data.
   * @param script Optional script text to compare against.
   * @returns A promise resolving to the final processed audio (Blob/URL) or throws an error.
   *          Currently returns an object with found segments due to unimplemented processing.
   */
    async analyzeAndCleanInternal(audioBase64: string, script?: string): Promise<{ message: string; foundSegments: CleanSegment[] } | string | Blob> { // Update return type when implemented
        const analysisResult = await this.analyzeInternal(audioBase64, script);
        const perfectTakes = this.extractSegmentsFromResult(analysisResult);

        if (!perfectTakes || perfectTakes.length === 0) {
            console.warn('No perfect takes found in the audio based on the criteria.');
            return { message: "Analysis complete: No perfect takes found.", foundSegments: [] };
        }

        console.log(`Found ${perfectTakes.length} potential perfect takes.`);

        // --- Processing Step (Currently Placeholder) ---
        try {
             // Once implemented, pass base64 data
             // return await this.processAndCombineSegmentsInternal(audioBase64, perfectTakes);

             console.warn('Segment extraction successful, but actual audio processing/combining is not implemented yet.');
             return {
                message: "Analysis complete, processing not implemented.",
                foundSegments: perfectTakes
             };

        } catch (error) {
            console.error('Failed to process and combine segments:', error);
            throw error;
        }
        // --- End Processing Step ---
    }

}

// Create a single instance for internal use
const analyzerInstance = new AudioAnalyzer();

// Export async functions that use the internal class instance

/**
 * Analyzes the provided audio data (as base64) to identify perfect takes.
 *
 * @param audioBase64 The base64 encoded string of the audio data.
 * @param script Optional script text to compare against.
 * @returns A promise that resolves with the analysis result (containing segments) or throws an error.
 */
export async function analyzeAudio(audioBase64: string, script?: string): Promise<AnalyzeAudioForCleanSegmentsOutput> {
    // Directly pass the base64 string to the internal method
    return analyzerInstance.analyzeInternal(audioBase64, script);
}

/**
 * Placeholder for the cropping/stitching logic based on analysis results.
 *
 * @param audioBase64 The base64 encoded audio data.
 * @param segments The clean segments identified by the analyze method.
 * @returns A promise resolving to the URL or Blob of the final processed audio.
 */
export async function processAndCombineAudioSegments(audioBase64: string, segments: CleanSegment[]): Promise<string | Blob> {
    return analyzerInstance.processAndCombineSegmentsInternal(audioBase64, segments);
}

/**
 * Combines analysis and processing (cropping/stitching).
 * Note: The cropping/stitching part is not yet implemented.
 *
 * @param audioBase64 The base64 encoded string of the audio data.
 * @param script Optional script text to compare against.
 * @returns A promise resolving to the final processed audio (Blob/URL) or throws an error.
 *          Currently returns an object with found segments due to unimplemented processing.
 */
export async function analyzeAndCleanAudio(audioBase64: string, script?: string): Promise<{ message: string; foundSegments: CleanSegment[] } | string | Blob> {
    return analyzerInstance.analyzeAndCleanInternal(audioBase64, script);
}

// Re-export the types for external use if needed
export type { CleanSegment };
