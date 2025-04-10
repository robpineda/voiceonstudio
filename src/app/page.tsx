
import {AudioTimeline} from '@/components/audio-timeline';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Textarea} from '@/components/ui/textarea';

export default function Home() {
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
            <input type="file" id="audioUpload" className="border rounded p-2" />
          </div>
          <div className="flex flex-col space-y-2">
            <label htmlFor="scriptText">Paste Script</label>
            <Textarea id="scriptText" placeholder="Paste your script here..." className="border rounded p-2" />
          </div>
          <Button>Analyze Audio</Button>
          <AudioTimeline />
        </CardContent>
      </Card>
    </div>
  );
}

