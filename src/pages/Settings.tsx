import { useCrowdData } from '@/hooks/useCrowdDataStandalone';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const SettingsPage = () => {
  const { threshold, setThreshold, autoAlert, setAutoAlert, clearLogs } = useCrowdData();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="label-text text-base">Settings</h1>

      {/* Threshold */}
      <div className="monitor-card p-6">
        <span className="label-text">Crowd Threshold</span>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Set the maximum people count before alerts are triggered.
        </p>
        <div className="flex items-center gap-4">
          <Slider
            value={[threshold]}
            onValueChange={([v]) => setThreshold(v)}
            min={50}
            max={500}
            step={10}
            className="flex-1"
          />
          <span className="text-2xl data-value text-foreground w-16 text-right">{threshold}</span>
        </div>
      </div>

      {/* Auto Alert */}
      <div className="monitor-card p-6 flex items-center justify-between">
        <div>
          <span className="label-text">Auto-Alert</span>
          <p className="text-xs text-muted-foreground mt-1">
            Automatically trigger alerts when threshold is exceeded.
          </p>
        </div>
        <Switch checked={autoAlert} onCheckedChange={setAutoAlert} />
      </div>

      {/* Reset Logs */}
      <div className="monitor-card p-6 flex items-center justify-between">
        <div>
          <span className="label-text">Reset Logs</span>
          <p className="text-xs text-muted-foreground mt-1">
            Clear all system logs and alert history.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={clearLogs}>
          Reset
        </Button>
      </div>

      {/* System Info */}
      <div className="monitor-card p-6">
        <span className="label-text">System Information</span>
        <div className="mt-4 space-y-3 text-xs font-mono">
          {[
            ['Model', 'YOLOv8n'],
            ['Backend', 'Flask / Python 3.11'],
            ['Frontend', 'React / TypeScript'],
            ['Camera', 'CAM_01 // NORTH_ENTRANCE'],
            ['Resolution', '1920 × 1080'],
            ['Version', 'v1.0.0'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-border/10 pb-2">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-foreground">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
