// SummarizeAudioErrors Story
'use server';
/**
 * @fileOverview Summarizes potential errors in an audio file.
 *
 * - summarizeAudioErrors - A function that summarizes the audio errors.
 * - SummarizeAudioErrorsInput - The input type for the summarizeAudioErrors function.
 * - SummarizeAudioErrorsOutput - The return type for the summarizeAudioErrors function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SummarizeAudioErrorsInputSchema = z.object({
  audioTimeline: z.string().describe('The audio timeline with identified clean segments and potential errors.'),
});
export type SummarizeAudioErrorsInput = z.infer<typeof SummarizeAudioErrorsInputSchema>;

const SummarizeAudioErrorsOutputSchema = z.object({
  summary: z.string().describe('A summary of potential errors or unwanted sections in the audio file.'),
});
export type SummarizeAudioErrorsOutput = z.infer<typeof SummarizeAudioErrorsOutputSchema>;

export async function summarizeAudioErrors(input: SummarizeAudioErrorsInput): Promise<SummarizeAudioErrorsOutput> {
  return summarizeAudioErrorsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeAudioErrorsPrompt',
  input: {
    schema: z.object({
      audioTimeline: z.string().describe('The audio timeline with identified clean segments and potential errors.'),
    }),
  },
  output: {
    schema: z.object({
      summary: z.string().describe('A summary of potential errors or unwanted sections in the audio file.'),
    }),
  },
  prompt: `You are an expert audio editor.

You will receive an audio timeline with identified clean segments and potential errors.

Your task is to provide a concise summary of the potential errors or unwanted sections in the audio file, so the voice actor can quickly understand the areas needing attention and make informed editing decisions.

Audio Timeline: {{{audioTimeline}}}

Summary: `,
});

const summarizeAudioErrorsFlow = ai.defineFlow<
  typeof SummarizeAudioErrorsInputSchema,
  typeof SummarizeAudioErrorsOutputSchema
>(
  {
    name: 'summarizeAudioErrorsFlow',
    inputSchema: SummarizeAudioErrorsInputSchema,
    outputSchema: SummarizeAudioErrorsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
