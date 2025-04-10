'use client'

import {useState, useRef} from 'react';
import {AudioTimeline} from '@/components/audio-timeline';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Textarea} from '@/components/ui/textarea';
import {Icons} from '@/components/icons';

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleScriptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setScriptText(event.target.value);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(recordedChunks, {type: 'audio/wav'});
        const audioFile = new File([audioBlob], 'recording.wav', {type: 'audio/wav'});
        setAudioFile(audioFile);
        setRecordedChunks([]);
        setIsRecording(false);
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
    }
  };

  const analyzeAudio = () => {
    if (!audioFile) {
      alert('Please upload or record an audio file first.');
      return;
    }
    // Placeholder for analyze audio function
    console.log('Analyzing audio:', audioFile, 'with script:', scriptText);
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Voice Polisher</CardTitle>
          <CardDescription>Analyze and polish your voice recordings.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="audioUpload">Upload Audio File</label>
            <input type="file" id="audioUpload" className="border rounded p-2" onChange={handleFileChange} />
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="secondary" onClick={isRecording ? stopRecording : startRecording}>
              {isRecording ? (
                <>
                  <Icons.pause className="mr-2 h-4 w-4" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Icons.record className="mr-2 h-4 w-4" />
                  Start Recording
                </>
              )}
            </Button>
            {audioFile && <p>Audio file: {audioFile.name}</p>}
          </div>
          <div className="flex flex-col space-y-2">
            <label htmlFor="scriptText">Paste Script</label>
            <Textarea id="scriptText" placeholder="Paste your script here..." className="border rounded p-2" onChange={handleScriptChange} />
          </div>
          <Button onClick={analyzeAudio}>Analyze Audio</Button>
          <AudioTimeline />
        </CardContent>
      </Card>
    </div>
  );
}


    