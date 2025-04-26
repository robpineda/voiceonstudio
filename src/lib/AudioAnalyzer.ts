'use server';

// Import the updated types from the AI flow
import {
  analyzeAudioForCleanSegments,
  AnalyzeAudioForCleanSegmentsInput,
  AnalyzeAudioForCleanSegmentsOutput, // Use the specific output type
  SegmentSchema, // Use the exported schema
} from '@/ai/flows/analyze-audio-for-clean-segments';
import { z } from 'zod';

// Define CleanSegment based on the AI flow's exported SegmentSchema
type CleanSegment = z.infer<typeof SegmentSchema>; // Contains start, end, confidence

// Keep the class internal to the module
class AudioAnalyzer {
  /**
   * Analyzes the provided audio file URL to identify perfect takes (clean, coherent, script-accurate segments).
   *
   * @param audioUrl The URL of the audio file to analyze.
   * @param script Optional script text to compare against.
   * @returns A promise that resolves with the analysis result (containing segments) or throws an error.
   */
  async analyzeInternal(audioUrl: string, script?: string): Promise<AnalyzeAudioForCleanSegmentsOutput> {
    if (!audioUrl) {
      throw new Error('Audio URL must be provided.');
    }

    console.log(`Analyzing audio: ${audioUrl}`);
    if (script) {
      console.log('Using provided script for analysis.');
    }

    try {
      const input: AnalyzeAudioForCleanSegmentsInput = { audioUrl, script };
      // Call the updated AI flow
      const analysisResult = await analyzeAudioForCleanSegments(input);

      console.log('Audio analysis successful:', analysisResult);

      // Return the structured result from the flow
      return analysisResult ?? { segments: [] }; // Return empty segments if result is null/undefined

    } catch (error) {
      console.error('Error analyzing audio:', error);
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
      // The AI flow now directly returns the desired structure.
      // Optionally filter by confidence here if needed.
      // Example: return analysisResult.segments.filter(seg => seg.confidence > 0.75);
      return analysisResult.segments;
  }


  /**
   * Placeholder for the cropping/stitching logic based on analysis results.
   * This would likely require additional tools or libraries for audio manipulation.
   *
   * @param audioUrl The original audio URL.
   * @param segments The clean segments identified by the analyze method.
   * @returns A promise resolving to the URL or Blob of the final processed audio.
   */
  async processAndCombineSegmentsInternal(audioUrl: string, segments: CleanSegment[]): Promise<string | Blob> {
      console.log(`Processing audio ${audioUrl} with segments:`, segments);

      if (!segments || segments.length === 0) {
          console.warn("No segments provided for processing.");
          throw new Error("Cannot process audio: No clean segments provided.");
      }

      // Sort segments by start time just in case the AI didn't
      segments.sort((a, b) => a.start - b.start);

      // TODO: Implement actual audio processing logic here using tools like ffmpeg.
      // Steps:
      // 1. Fetch audio data.
      // 2. Use ffmpeg (e.g., ffmpeg.wasm on client, or server-side ffmpeg) to:
      //    a. Extract each segment: `ffmpeg -i input.wav -ss {start} -to {end} -c copy output_segment_{n}.wav`
      //    b. Create a list file (mylist.txt) for concatenation: `file 'output_segment_0.wav'`
      //    c. Concatenate: `ffmpeg -f concat -safe 0 -i mylist.txt -c copy final_output.wav`
      // 3. Return the final audio Blob or URL.

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
   * @param audioUrl The URL of the audio file to analyze and process.
   * @param script Optional script text to compare against.
   * @returns A promise resolving to the final processed audio (Blob/URL) or throws an error.
   *          Currently returns an object with found segments due to unimplemented processing.
   */
    async analyzeAndCleanInternal(audioUrl: string, script?: string): Promise<{ message: string; foundSegments: CleanSegment[] } | string | Blob> { // Update return type when implemented
        const analysisResult = await this.analyzeInternal(audioUrl, script);
        const perfectTakes = this.extractSegmentsFromResult(analysisResult);

        if (!perfectTakes || perfectTakes.length === 0) {
            console.warn('No perfect takes found in the audio based on the criteria.');
            // Consider returning an empty result or specific status instead of throwing
            return { message: "Analysis complete: No perfect takes found.", foundSegments: [] };
            // Or: throw new Error('No suitable audio segments found to process.');
        }

        console.log(`Found ${perfectTakes.length} potential perfect takes.`);
        // console.log('Segments:', perfectTakes); // Uncomment to log segments

        // --- Processing Step (Currently Placeholder) ---
        try {
             // Once implemented, this will return the final audio Blob/URL
             // return await this.processAndCombineSegmentsInternal(audioUrl, perfectTakes);

             // For now, return the segments found and log a warning
             console.warn('Segment extraction successful, but actual audio processing/combining is not implemented yet.');
             return {
                message: "Analysis complete, processing not implemented.",
                foundSegments: perfectTakes
             };

        } catch (error) {
            console.error('Failed to process and combine segments:', error);
            // Rethrow or handle the processing error
            throw error;
        }
        // --- End Processing Step ---
    }

}

// Create a single instance for internal use (optional, but can be efficient)
const analyzerInstance = new AudioAnalyzer();

// Export async functions that use the internal class instance

/**
 * Analyzes the provided audio file URL to identify perfect takes (clean, coherent, script-accurate segments).
 *
 * @param audioUrl The URL of the audio file to analyze.
 * @param script Optional script text to compare against.
 * @returns A promise that resolves with the analysis result (containing segments) or throws an error.
 */
export async function analyzeAudio(audioUrl: string, script?: string): Promise<AnalyzeAudioForCleanSegmentsOutput> {
    return analyzerInstance.analyzeInternal(audioUrl, script);
}

/**
 * Placeholder for the cropping/stitching logic based on analysis results.
 * This would likely require additional tools or libraries for audio manipulation.
 *
 * @param audioUrl The original audio URL.
 * @param segments The clean segments identified by the analyze method.
 * @returns A promise resolving to the URL or Blob of the final processed audio.
 */
export async function processAndCombineAudioSegments(audioUrl: string, segments: CleanSegment[]): Promise<string | Blob> {
    return analyzerInstance.processAndCombineSegmentsInternal(audioUrl, segments);
}

/**
 * Combines analysis and processing (cropping/stitching).
 * Identifies perfect takes and (eventually) combines them.
 * Note: The cropping/stitching part (processAndCombineSegments) is not yet implemented.
 *
 * @param audioUrl The URL of the audio file to analyze and process.
 * @param script Optional script text to compare against.
 * @returns A promise resolving to the final processed audio (Blob/URL) or throws an error.
 *          Currently returns an object with found segments due to unimplemented processing.
 */
export async function analyzeAndCleanAudio(audioUrl: string, script?: string): Promise<{ message: string; foundSegments: CleanSegment[] } | string | Blob> {
    return analyzerInstance.analyzeAndCleanInternal(audioUrl, script);
}

// Re-export the types for external use if needed (e.g., in page.tsx)
export type { CleanSegment };
