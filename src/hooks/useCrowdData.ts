import { useState, useEffect, useCallback } from 'react';

export type RiskLevel = 'safe' | 'warning' | 'danger';

export interface CrowdData {
  peopleCount: number;
  instantCount?: number;
  uniqueCount?: number;
  harmfulObjectCount?: number;
  harmfulObjectLabels?: string[];
  frameVersion?: number;
  threshold: number;
  riskLevel: RiskLevel;
  counting?: boolean;
  mediaType?: 'video' | 'image' | null;
  processingSeconds?: number;
  timestamp: string;
  trendData: { time: string; count: number }[];
  logs: { timestamp: string; event: string; count: number; status: string }[];
  alerts: { timestamp: string; count: number; risk: RiskLevel; triggered: boolean }[];
}

const generateTrendData = () => {
  const data: { time: string; count: number }[] = [];
  const now = new Date();
  for (let i = 59; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60000);
    data.push({
      time: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      count: Math.floor(80 + Math.random() * 120 + Math.sin(i / 8) * 40),
    });
  }
  return data;
};

const generateLogs = () => [
  { timestamp: '14:02:31', event: 'Threshold Adjusted', count: 0, status: 'OK' },
  { timestamp: '14:01:15', event: 'Person Count Updated', count: 142, status: 'OK' },
  { timestamp: '13:58:42', event: 'Camera Reconnected', count: 0, status: 'OK' },
  { timestamp: '13:55:01', event: 'High Crowd Warning', count: 245, status: 'WARNING' },
  { timestamp: '13:50:22', event: 'System Health Check', count: 0, status: 'OK' },
  { timestamp: '13:45:10', event: 'Detection Model Loaded', count: 0, status: 'OK' },
  { timestamp: '13:40:05', event: 'Stream Initialized', count: 0, status: 'OK' },
];

const generateAlerts = (): CrowdData['alerts'] => [
  { timestamp: '14:02:31', count: 142, risk: 'safe', triggered: false },
  { timestamp: '13:55:01', count: 245, risk: 'warning', triggered: true },
  { timestamp: '13:42:18', count: 310, risk: 'danger', triggered: true },
  { timestamp: '13:30:44', count: 180, risk: 'warning', triggered: true },
  { timestamp: '13:20:12', count: 95, risk: 'safe', triggered: false },
  { timestamp: '13:10:33', count: 280, risk: 'warning', triggered: true },
  { timestamp: '12:58:07', count: 350, risk: 'danger', triggered: true },
  { timestamp: '12:45:55', count: 120, risk: 'safe', triggered: false },
];

function getRiskLevel(count: number, threshold: number): RiskLevel {
  const ratio = count / threshold;
  if (ratio >= 0.8) return 'danger';
  if (ratio >= 0.5) return 'warning';
  return 'safe';
}

export function useCrowdData() {
  const [threshold, setThreshold] = useState(300);
  const [autoAlert, setAutoAlert] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState<CrowdData>(() => ({
    peopleCount: 0,
    instantCount: 0,
    uniqueCount: 0,
    harmfulObjectCount: 0,
    harmfulObjectLabels: [],
    frameVersion: 0,
    threshold,
    riskLevel: 'safe',
    counting: false,
    mediaType: null,
    processingSeconds: 0,
    timestamp: new Date().toLocaleTimeString(),
    trendData: [],
    logs: [],
    alerts: [],
  }));

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`http://${window.location.hostname}:5000/stats`);
      if (response.ok) {
        const stats = await response.json();
        setData(prev => ({
          ...stats,
          // Merge trend data if needed or replace
          threshold: stats.threshold || threshold,
          counting: Boolean(stats.counting),
        }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [threshold]);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`http://${window.location.hostname}:5000/health`);
      if (response.ok) {
        const health = await response.json();
        setIsProcessing(health.processing);
      }
    } catch (error) {
      console.error('Error checking health:', error);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      checkHealth();
    }, 350);
    return () => clearInterval(interval);
  }, [fetchStats, checkHealth]);

  const startProcessing = useCallback(async () => {
    try {
      const response = await fetch(`http://${window.location.hostname}:5000/start`, { method: 'POST' });
      if (response.ok) {
        const payload = await response.json();
        // For images, backend processes immediately and returns counting=false.
        setIsProcessing(Boolean(payload.counting));
        await fetchStats();
        await checkHealth();
      } else {
        const errorText = await response.text();
        console.error('Start processing failed:', errorText);
      }
    } catch (error) {
      console.error('Error starting processing:', error);
    }
  }, [checkHealth, fetchStats]);

  const stopProcessing = useCallback(async () => {
    try {
      const response = await fetch(`http://${window.location.hostname}:5000/stop`, { method: 'POST' });
      if (response.ok) setIsProcessing(false);
    } catch (error) {
      console.error('Error stopping processing:', error);
    }
  }, []);

  const uploadMedia = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('media', file);
    try {
      const response = await fetch(`http://${window.location.hostname}:5000/upload`, {
        method: 'POST',
        body: formData,
      });
      setIsProcessing(false);
      await fetchStats();
      await checkHealth();
      return response.ok;
    } catch (error) {
      console.error('Error uploading video:', error);
      return false;
    }
  }, [checkHealth, fetchStats]);

  const clearLogs = useCallback(() => {
    setData(prev => ({ ...prev, logs: [], alerts: [] }));
  }, []);

  const setThresholdOnBackend = useCallback(async (val: number) => {
    try {
      await fetch(`http://${window.location.hostname}:5000/threshold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: val }),
      });
      setThreshold(val);
    } catch (error) {
      console.error('Error updating threshold:', error);
    }
  }, []);

  return { 
    data, 
    threshold, 
    setThreshold: setThresholdOnBackend, 
    autoAlert, 
    setAutoAlert, 
    clearLogs,
    isProcessing,
    startProcessing,
    stopProcessing,
    uploadMedia
  };
}
