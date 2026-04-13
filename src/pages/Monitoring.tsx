import { useCrowdData } from '@/hooks/useCrowdDataStandalone';
import { RiskBadge } from '@/components/RiskBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRef, useState } from 'react';
import { Play, Square, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';

const Monitoring = () => {
  const { data, isProcessing, startProcessing, stopProcessing, uploadMedia } = useCrowdData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const shouldShowFeed = isProcessing || data.mediaType === 'image';
  const feedSrc = data.mediaType === 'image'
    ? `https://${window.location.hostname}:5000/latest_frame.jpg?v=${data.frameVersion ?? 0}`
    : `https://${window.location.hostname}:5000/video_feed`;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const success = await uploadMedia(file);
    setUploading(false);

    if (success) {
      toast.success('Media uploaded successfully');
    } else {
      toast.error('Failed to upload media');
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="label-text text-base">Live Monitoring</h1>
        <div className="flex items-center gap-3">
          <Input
            type="file"
            accept="video/*,image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[10px] gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isProcessing}
          >
            <Upload className="w-3 h-3" />
            {uploading ? 'Uploading...' : 'Upload Media'}
          </Button>
          <Button
            variant={isProcessing ? "destructive" : "default"}
            size="sm"
            className="h-8 text-[10px] gap-2"
            onClick={isProcessing ? stopProcessing : startProcessing}
            disabled={uploading}
          >
            {isProcessing ? (
              <>
                <Square className="w-3 h-3" /> Stop
              </>
            ) : (
              <>
                <Play className="w-3 h-3" /> Start
              </>
            )}
          </Button>
          <span className="text-[10px] text-muted-foreground font-mono">{data.timestamp}</span>
          <RiskBadge risk={data.riskLevel} size="sm" />
        </div>
      </div>

      {/* Large video area */}
      <div className="monitor-card relative overflow-hidden rounded-lg flex-1 min-h-[500px] bg-black">
        {shouldShowFeed ? (
          <img
            src={feedSrc}
            alt="Live Feed"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-background via-surface to-background flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 border-2 border-primary/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-primary/50" />
              </div>
              <p className="text-muted-foreground text-xs uppercase tracking-widest">SYSTEM READY</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">Upload video/image and click Start to begin detection</p>
            </div>
          </div>
        )}
        <div className="video-overlay absolute inset-0 pointer-events-none" />

        {/* Top HUD */}
        <div className="absolute top-4 left-4 flex gap-3">
          <div className="bg-background/60 backdrop-blur-md px-3 py-1.5 rounded border border-border/30">
            <span className="text-[10px] text-muted-foreground block">CAMERA</span>
            <span className="text-xs text-foreground">CAM_01</span>
          </div>
          <div className="bg-background/60 backdrop-blur-md px-3 py-1.5 rounded border border-border/30">
            <span className="text-[10px] text-muted-foreground block">MODEL</span>
            <span className="text-xs text-foreground">YOLOv8n + DeepSORT</span>
          </div>
          <div className="bg-background/60 backdrop-blur-md px-3 py-1.5 rounded border border-border/30">
            <span className="text-[10px] text-muted-foreground block">COUNT STATUS</span>
            <span className="text-xs text-foreground">
              {data.counting ? `Still counting (${data.processingSeconds ?? 0}s)` : 'Count complete'}
            </span>
          </div>
        </div>

        {/* Bottom HUD */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
          <div className="bg-background/60 backdrop-blur-md px-4 py-3 rounded border border-border/30">
            <span className="text-[10px] text-muted-foreground block">PERSONS DETECTED</span>
            <span className="text-5xl data-value text-foreground">{data.peopleCount}</span>
          </div>
          <RiskBadge risk={data.riskLevel} size="lg" />
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'People Count', value: data.mediaType === 'image' ? (data.instantCount ?? data.peopleCount) : data.peopleCount },
          { label: 'Unique Seen', value: data.uniqueCount ?? data.peopleCount },
          { label: 'Harmful Objects', value: data.harmfulObjectCount ?? 0 },
          { label: 'Threshold', value: data.threshold },
          { label: 'Status', value: data.counting ? 'COUNTING' : (isProcessing ? 'ACTIVE' : 'IDLE') },
        ].map((stat, i) => (
          <div key={i} className="monitor-card p-4">
            <span className="label-text">{stat.label}</span>
            <p className="text-2xl data-value text-foreground mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Monitoring;
