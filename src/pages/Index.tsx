import { useCrowdData } from '@/hooks/useCrowdDataStandalone';
import { RiskBadge } from '@/components/RiskBadge';
import { CrowdTrendChart } from '@/components/CrowdTrendChart';
import { AlertBanner } from '@/components/AlertBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRef, useState } from 'react';
import { Play, Square, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard = () => {
  const { data, isProcessing, startProcessing, stopProcessing, uploadMedia } = useCrowdData();
  const [alertDismissed, setAlertDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const shouldShowFeed = isProcessing || data.mediaType === 'image';
  const feedSrc = uploadedVideoUrl; // Show uploaded video
  
  const showAlert = data.riskLevel === 'danger' && !alertDismissed;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    // Create video URL for display
    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setUploadedVideoUrl(url);
    }
    
    const success = await uploadMedia(file);
    setUploading(false);

    if (success) {
      toast.success('Media uploaded successfully');
    } else {
      toast.error('Upload failed');
    }
  };

  return (
    <>
      <AlertBanner show={showAlert} onDismiss={() => setAlertDismissed(true)} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Video Feed */}
        <div className="lg:col-span-2 lg:row-span-2 monitor-card relative overflow-hidden rounded-lg min-h-[400px] bg-black">
          {shouldShowFeed ? (
            <img
              src={feedSrc}
              alt="Live Feed"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-background via-surface to-background flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-2 border-primary/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="w-6 h-6 text-primary/50" />
                </div>
                <p className="text-muted-foreground text-xs uppercase tracking-widest">CAM_01 • LIVE FEED</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Start processing to stream</p>
              </div>
            </div>
          )}
          <div className="video-overlay absolute inset-0 pointer-events-none" />
          
          {/* HUD overlays */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="bg-background/60 backdrop-blur-md px-3 py-1.5 rounded border border-border/30">
              <span className="text-[10px] text-muted-foreground block leading-none mb-1">CAM_01</span>
              <span className="text-xs font-mono tracking-tighter text-foreground">{data.timestamp}</span>
            </div>
            <div className="bg-background/60 backdrop-blur-md px-3 py-1.5 rounded border border-border/30">
              <span className="text-[10px] text-muted-foreground block leading-none mb-1">COUNT STATUS</span>
              <span className="text-xs font-mono tracking-tighter text-foreground">
                {data.counting ? `still counting (${data.processingSeconds ?? 0}s)` : 'count complete'}
              </span>
            </div>
            
            <div className="flex gap-2">
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
                className="h-7 text-[9px] gap-1.5 bg-background/60 backdrop-blur-md border-border/30"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || isProcessing}
              >
                <Upload className="w-3 h-3" />
                {uploading ? '...' : 'Upload Media'}
              </Button>
              <Button
                variant={isProcessing ? "destructive" : "default"}
                size="sm"
                className={`h-7 text-[9px] gap-1.5 backdrop-blur-md border-border/30 ${!isProcessing ? 'bg-primary/80' : 'bg-destructive/80'}`}
                onClick={isProcessing ? stopProcessing : startProcessing}
                disabled={uploading}
              >
                {isProcessing ? (
                  <>
                    <Square className="w-2.5 h-2.5" /> Stop
                  </>
                ) : (
                  <>
                    <Play className="w-2.5 h-2.5" /> Start
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="absolute bottom-4 right-4">
            <RiskBadge risk={data.riskLevel} size="lg" />
          </div>
          <div className="absolute bottom-4 left-4 bg-background/60 backdrop-blur-md px-3 py-1.5 rounded border border-border/30">
            <span className="text-[10px] text-muted-foreground block">DETECTED</span>
            <span className="text-2xl data-value text-foreground">
              {data.mediaType === 'image' ? (data.instantCount ?? data.peopleCount) : data.peopleCount}
            </span>
          </div>
        </div>

        {/* Current Occupancy */}
        <div className="monitor-card p-6 flex flex-col justify-center">
          <span className="label-text mb-2">Current Occupancy</span>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl data-value text-foreground">
              {data.mediaType === 'image' ? (data.instantCount ?? data.peopleCount) : data.peopleCount}
            </span>
            <span className="text-xl font-medium text-muted-foreground/30">/ {data.threshold}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Unique seen: {data.uniqueCount ?? data.peopleCount}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Harmful objects: {data.harmfulObjectCount ?? 0}
            {(data.harmfulObjectLabels?.length ?? 0) > 0 ? ` (${data.harmfulObjectLabels?.join(', ')})` : ''}
          </p>
          <div className="w-full bg-muted/30 h-1.5 mt-6 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (data.peopleCount / data.threshold) * 100)}%`,
                backgroundColor:
                  data.riskLevel === 'danger' ? 'hsl(0, 100%, 60%)' :
                  data.riskLevel === 'warning' ? 'hsl(45, 100%, 50%)' :
                  'hsl(150, 100%, 50%)',
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-[10px] text-muted-foreground">Threshold: {data.threshold}</span>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="monitor-card p-4">
          <span className="label-text">Crowd Density (60m)</span>
          <div className="mt-4">
            <CrowdTrendChart data={data.trendData} height={160} />
          </div>
        </div>

        {/* System Logs */}
        <div className="lg:col-span-3 monitor-card p-4 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <span className="label-text">System Event Log</span>
            <span className="text-[10px] font-mono text-primary">LIVE_SYNC_ACTIVE</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-muted-foreground/40 border-b border-border/20">
                <tr>
                  <th className="pb-2 font-medium">TIMESTAMP</th>
                  <th className="pb-2 font-medium">EVENT</th>
                  <th className="pb-2 font-medium">COUNT</th>
                  <th className="pb-2 font-medium text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="text-foreground/70">
                {data.logs.map((log, i) => (
                  <tr key={i} className="border-b border-border/10">
                    <td className="py-2">{log.timestamp}</td>
                    <td className="py-2 text-foreground">{log.event}</td>
                    <td className="py-2">{log.count}</td>
                    <td className="py-2 text-right">
                      <span className={log.status === 'OK' ? 'text-primary' : 'text-warning'}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
