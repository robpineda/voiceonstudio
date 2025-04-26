import * as z from 'zod';
import fetch from 'node-fetch'; // Using node-fetch for broader compatibility
import { execSync } from 'child_process'; // Import for gcloud fallback

// --- Schemas (remain the same) ---
export const AnalyzeAudioForCleanSegmentsInputSchema = z.object({
  audioUrl: z.string().url(),
  script: z.string().optional(),
});
export type AnalyzeAudioForCleanSegmentsInput = z.infer<
  typeof AnalyzeAudioForCleanSegmentsInputSchema
>;

export const SegmentSchema = z.object({
  start: z.number().describe('Start time of the segment in seconds'),
  end: z.number().describe('End time of the segment in seconds'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'Confidence score (0-1) indicating the likelihood of the segment being a perfectly spoken, coherent take, matching the script if provided.'
    ),
  // Optional: Add transcript snippet for the segment?
  // transcript: z.string().optional().describe('The text transcribed for this segment'),
});

export const AnalyzeAudioForCleanSegmentsOutputSchema = z.object({
  segments: z.array(SegmentSchema),
});
export type AnalyzeAudioForCleanSegmentsOutput = z.infer<
  typeof AnalyzeAudioForCleanSegmentsOutputSchema
>;
// --- End Schemas ---

// --- DeepSeek API Configuration ---
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
// --- End DeepSeek Config ---

// --- Google Cloud Speech-to-Text Configuration ---
// Uses ADC by default. Ensure API is enabled and permissions are set.
const GOOGLE_STT_API_ENDPOINT = `https://speech.googleapis.com/v1/speech:recognize`;
// --- End STT Config ---


// Helper Function to get Google Cloud Access Token (using metadata server or gcloud)
// Note: Genkit or Google Cloud libraries often handle this automatically via ADC.
// This helper is a fallback/example if direct token fetching is needed.
// In many environments (GCP, local with gcloud auth), fetch might automatically add the token.
async function getGoogleAccessToken(): Promise<string> {
    // Try metadata server first (common in GCP environments)
    try {
        const metadataUrl = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
        // Use node-fetch explicitly here
        const response = await fetch(metadataUrl, {
            headers: { 'Metadata-Flavor': 'Google' }
        });
        if (!response.ok) throw new Error(`Metadata server request failed: ${response.status}`);
        // Need to await response.json()
        const data = await response.json() as { access_token: string };
        if (!data.access_token) throw new Error('Metadata server response did not contain access_token');
        console.log("Obtained access token via metadata server.");
        return data.access_token;
    } catch (error: any) {
        console.warn("Could not get access token from metadata server:", error.message);
        // Fallback: Try using gcloud command (requires gcloud SDK installed and configured)
        // This is less ideal for production servers. ADC should be preferred.
        try {
            // execSync is already imported
            const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
            if (!token) throw new Error('gcloud command returned empty token.');
            console.log("Obtained access token via gcloud command.");
            return token;
        } catch (gcloudError: any) {
            console.error("Could not get access token via gcloud:", gcloudError.message);
            throw new Error("Failed to obtain Google Cloud access token. Ensure ADC is configured or gcloud is installed and authenticated.");
        }
    }
}

// Export the function directly, removing the defineFlow wrapper
export async function analyzeAudioForCleanSegments(
    input: AnalyzeAudioForCleanSegmentsInput
): Promise<AnalyzeAudioForCleanSegmentsOutput> {
    // Validate input using the Zod schema
    const validationResult = AnalyzeAudioForCleanSegmentsInputSchema.safeParse(input);
    if (!validationResult.success) {
        throw new Error(`Invalid input: ${validationResult.error.message}`);
    }
    const { audioUrl, script } = validationResult.data; // Use validated data


    if (!DEEPSEEK_API_KEY) {
        throw new Error("DeepSeek API Key (DEEPSEEK_API_KEY) is not configured.");
    }

    // === 1. Fetch Audio Data ===
    console.log(`Fetching audio from: ${audioUrl}`);
    let audioBuffer: Buffer;
    try {
        // Use node-fetch explicitly
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Failed to fetch audio: ${audioResponse.status} ${audioResponse.statusText}`);
        }
        // Read as ArrayBuffer then convert to Buffer for base64 encoding
        const audioArrayBuffer = await audioResponse.arrayBuffer();
        audioBuffer = Buffer.from(audioArrayBuffer);
        console.log(`Audio fetched successfully (${(audioBuffer.length / 1024).toFixed(2)} KB).`);
    } catch (error: any) {
        console.error("Error fetching audio:", error);
        throw new Error(`Failed to fetch audio data from URL: ${error.message}`);
    }

    // === 2. Perform Speech-to-Text ===
    console.log("Initiating Speech-to-Text analysis with Google Cloud...");
    let transcript = "";
    let wordsWithTimings: { word: string; startTime: number; endTime: number }[] = [];
    let googleAccessToken: string;

    try {
        googleAccessToken = await getGoogleAccessToken(); // Fetch token

        const audioBase64 = audioBuffer.toString('base64');
        const sttRequest = {
            config: {
                // encoding: 'LINEAR16', // Example: Specify encoding if known (e.g., 'LINEAR16', 'MP3', 'FLAC', 'WEBM_OPUS').
                // sampleRateHertz: 16000, // Example: Specify if known
                languageCode: 'en-US', // Adjust language code as needed
                enableWordTimeOffsets: true, // Crucial for getting word timings
                // model: 'telephony', // Choose model based on audio type
                // audioChannelCount: 1, // Specify if known
                enableAutomaticPunctuation: true,
                // Use enhanced model for potentially better accuracy if needed
                // useEnhanced: true,
            },
            audio: {
                content: audioBase64,
            },
        };

        // Use node-fetch explicitly
        const sttResponse = await fetch(GOOGLE_STT_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${googleAccessToken}`, // Use fetched token
                // Add 'x-goog-user-project' header if quota project differs from auth project
                // 'x-goog-user-project': 'your-quota-project-id',
            },
            body: JSON.stringify(sttRequest),
        });

        const sttResponseText = await sttResponse.text(); // Read raw text first

        if (!sttResponse.ok) {
            console.error("Google STT API Error Response:", sttResponseText);
            throw new Error(`Google Speech-to-Text API request failed: ${sttResponse.status} ${sttResponse.statusText} - ${sttResponseText}`);
        }

        const sttResult = JSON.parse(sttResponseText);

        // Process results - expecting results array, process all parts
        if (sttResult.results && sttResult.results.length > 0) {
            sttResult.results.forEach((result: any) => {
                const alternative = result.alternatives?.[0];
                if (alternative) {
                    transcript += (alternative.transcript || "") + " "; // Append transcript parts
                    if (alternative.words) {
                        alternative.words.forEach((wordInfo: any) => {
                           wordsWithTimings.push({
                                word: wordInfo.word,
                                startTime: parseFloat(wordInfo.startTime?.replace('s', '') || '0'),
                                endTime: parseFloat(wordInfo.endTime?.replace('s', '') || '0'),
                           });
                        });
                    }
                }
            });
            transcript = transcript.trim(); // Trim trailing space
            console.log(`Speech-to-Text successful. Transcript length: ${transcript.length}, Words: ${wordsWithTimings.length}`);
            // console.log("Transcript:", transcript);
            // console.log("Words with Timings:", wordsWithTimings);
        } else {
             console.warn("STT analysis returned no results or empty results array:", sttResult);
             // Consider this scenario - maybe return empty segments?
             return { segments: [] }; // Return empty if no transcript
            // Or: throw new Error("Speech-to-Text analysis returned no results.");
        }

    } catch (error: any) {
        console.error("Error during Speech-to-Text:", error);
        throw new Error(`Speech-to-Text analysis failed: ${error.message}`);
    }


    // === 3. Call LLM (DeepSeek) with Transcript ===
    console.log("Constructing prompt for DeepSeek using STT results...");

    // Format transcript with timings for the prompt (optional but helpful)
    const formattedTranscript = wordsWithTimings
        .map(w => `[${w.startTime.toFixed(2)}s-${w.endTime.toFixed(2)}s] ${w.word}`)
        .join(' ');

    const llmPrompt = `
You are an AI expert specializing in analyzing voice acting recordings based on provided transcripts WITH WORD TIMINGS. Your task is to identify "perfect takes". A perfect take is a segment of speech that is:
1.  Fluent and coherent: Spoken clearly without stumbles, significant unnatural pauses (indicated by large gaps between word end/start times), restarts, or filler words identifiable from the transcript.
2.  Accurate (if a script is provided): The spoken words in the transcript must closely match the provided script text for that segment.

Analyze the following transcript (with word timings). Identify all segments that qualify as perfect takes based ONLY on the criteria above (fluency, coherence, script accuracy). Assume the original audio quality was acceptable.

Transcript with word timings:
"""
${formattedTranscript || transcript} // Use formatted if available, otherwise plain transcript
"""

${script ? `Script for comparison:
"""
${script}
"""` : 'No script provided. Focus ONLY on fluency and coherence based on the transcript.'}

Return the results ONLY as a single valid JSON object containing an array named "segments". Do NOT include any explanation, commentary, or text outside the JSON object block. Each segment object in the array must include:
- "start": The start time of the perfect take in seconds (use the start time of the first word in the segment, formatted to 2 decimal places).
- "end": The end time of the perfect take in seconds (use the end time of the last word in the segment, formatted to 2 decimal places).
- "confidence": A score from 0.0 to 1.0 indicating your confidence that this segment is a perfect take according to the criteria (fluency, coherence, and script accuracy if applicable). Higher scores mean higher certainty.

Example output format:
{
  "segments": [
    {
      "start": 10.52,
      "end": 15.18,
      "confidence": 0.95
    },
    {
      "start": 25.09,
      "end": 32.75,
      "confidence": 0.98
    }
  ]
}

Base the start/end times strictly on the word timings provided in the transcript. Ensure your output strictly adheres to the JSON format. Output ONLY the JSON object.
`;

    // Construct the DeepSeek API Request Body
    const requestBody = {
        model: DEEPSEEK_MODEL,
        messages: [{ role: "user", content: llmPrompt }],
        temperature: 0.7,
        max_tokens: 2000, // Increase as prompt and transcript can be long
        // response_format: { type: "json_object" } // If supported
    };

    console.log(`Sending request to DeepSeek API (${DEEPSEEK_API_URL}) for transcript analysis...`);

    try {
        // Use node-fetch explicitly
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();

        if (!response.ok) {
            let errorDetails = responseText;
            try {
                 const errorJson = JSON.parse(responseText);
                 errorDetails = errorJson?.error?.message || responseText;
            } catch (parseError) { /* Ignore */ }
            throw new Error(`DeepSeek API request failed: ${response.status} ${response.statusText} - ${errorDetails}`);
        }

        const deepSeekResponse = JSON.parse(responseText);
        const messageContent = deepSeekResponse?.choices?.[0]?.message?.content?.trim();

        if (!messageContent) {
            console.error("DeepSeek response missing message content:", deepSeekResponse);
            throw new Error("DeepSeek response did not contain the expected message content.");
        }

        // Parse and validate the LLM's JSON output
        try {
            // Attempt to extract JSON block if the model added extra text
            const jsonMatch = messageContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            const jsonString = jsonMatch ? jsonMatch[1] : messageContent;

            const parsedOutput: AnalyzeAudioForCleanSegmentsOutput = JSON.parse(jsonString);
            const validationResult = AnalyzeAudioForCleanSegmentsOutputSchema.safeParse(parsedOutput);

            if (!validationResult.success) {
                 console.error("DeepSeek response content failed Zod validation:", validationResult.error);
                 console.error("Invalid content received (after potential extraction):", jsonString);
                 throw new Error(`DeepSeek response content structure validation failed: ${validationResult.error.message}`);
            }

            console.log("DeepSeek analysis successful, segments extracted from transcript analysis.");
            // Optional: Add transcript snippet to each segment here if desired
            // validationResult.data.segments.forEach(seg => { ... });
            return validationResult.data;

        } catch (jsonParseError: any) {
            console.error("Failed to parse JSON content from DeepSeek response:", jsonParseError);
            console.error("Content received:", messageContent);
            throw new Error(`Failed to parse the JSON content received from DeepSeek: ${jsonParseError.message}`);
        }

    } catch (error: any) {
        console.error("Error calling DeepSeek API or processing response:", error);
        throw new Error(`Failed to analyze transcript using DeepSeek: ${error.message}`);
    }
}
