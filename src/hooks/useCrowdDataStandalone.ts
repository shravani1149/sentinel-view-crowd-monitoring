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

  // Only simulate data when media is uploaded
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => ({
        ...prev,
        timestamp: new Date().toLocaleTimeString(),
        trendData: prev.mediaType ? generateTrendData() : [],
        logs: prev.mediaType ? generateLogs() : [],
        alerts: prev.mediaType ? generateAlerts() : [],
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [threshold]);

  const startProcessing = useCallback(async () => {
    setIsProcessing(true);
    // Simulate processing when media is available
    setTimeout(() => {
      const simulatedCount = Math.floor(120 + Math.random() * 80);
      setData(prev => ({
        ...prev,
        peopleCount: simulatedCount,
        instantCount: simulatedCount,
        uniqueCount: Math.floor(simulatedCount * 0.8),
        harmfulObjectCount: Math.floor(Math.random() * 3),
        harmfulObjectLabels: ['knife', 'weapon'].slice(0, Math.floor(Math.random() * 3)),
        frameVersion: prev.frameVersion ? prev.frameVersion + 1 : 1,
        riskLevel: getRiskLevel(simulatedCount, threshold),
        timestamp: new Date().toLocaleTimeString(),
        trendData: generateTrendData(),
        logs: generateLogs(),
        alerts: generateAlerts(),
        counting: true,
        processingSeconds: 5,
      }));
      setIsProcessing(false);
    }, 3000);
  }, []);

  const stopProcessing = useCallback(async () => {
    setIsProcessing(false);
  }, []);

  const uploadMedia = useCallback(async (file: File) => {
    // Simulate upload with realistic data
    setIsProcessing(true);
    setTimeout(() => {
      const simulatedCount = Math.floor(150 + Math.random() * 100);
      setData(prev => ({
        ...prev,
        peopleCount: simulatedCount,
        instantCount: simulatedCount,
        uniqueCount: Math.floor(simulatedCount * 0.8),
        harmfulObjectCount: Math.floor(Math.random() * 3),
        harmfulObjectLabels: ['knife', 'weapon'].slice(0, Math.floor(Math.random() * 3)),
        frameVersion: prev.frameVersion ? prev.frameVersion + 1 : 1,
        riskLevel: getRiskLevel(simulatedCount, threshold),
        timestamp: new Date().toLocaleTimeString(),
        trendData: generateTrendData(),
        logs: generateLogs(),
        alerts: generateAlerts(),
        mediaType: file.type.startsWith('video/') ? 'video' : 'image',
        counting: false,
        processingSeconds: 3,
      }));
      setIsProcessing(false);
    }, 2000);
    return true;
  }, []);

  const clearLogs = useCallback(() => {
    setData(prev => ({ ...prev, logs: [], alerts: [] }));
  }, []);

  const setThresholdOnBackend = useCallback(async (val: number) => {
    setThreshold(val);
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
