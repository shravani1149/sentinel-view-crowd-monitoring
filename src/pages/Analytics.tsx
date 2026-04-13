import { useCrowdData } from '@/hooks/useCrowdDataStandalone';
import { CrowdTrendChart } from '@/components/CrowdTrendChart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';

const Analytics = () => {
  const { data } = useCrowdData();

  // Derived statistics from real-time data
  const trendCounts = data.trendData.map(d => d.count);
  const peakCount = trendCounts.length > 0 ? Math.max(...trendCounts) : 0;
  const averageCount = trendCounts.length > 0 
    ? Math.round(trendCounts.reduce((a, b) => a + b, 0) / trendCounts.length) 
    : 0;
  const totalAlerts = data.alerts.length;

  // Mock distribution based on real risk level if possible, 
  // otherwise keep as placeholder but with more realistic values
  const riskDistribution = [
    { name: 'Safe', value: data.riskLevel === 'safe' ? 100 : 0, color: 'hsl(150, 100%, 50%)' },
    { name: 'Warning', value: data.riskLevel === 'warning' ? 100 : 0, color: 'hsl(45, 100%, 50%)' },
    { name: 'Danger', value: data.riskLevel === 'danger' ? 100 : 0, color: 'hsl(0, 100%, 60%)' },
  ];

  // If no data yet, show a more balanced mock distribution
  const effectiveDistribution = trendCounts.length > 0 ? riskDistribution : [
    { name: 'Safe', value: 80, color: 'hsl(150, 100%, 50%)' },
    { name: 'Warning', value: 15, color: 'hsl(45, 100%, 50%)' },
    { name: 'Danger', value: 5, color: 'hsl(0, 100%, 60%)' },
  ];

  const hourlyData = Array.from({ length: 12 }, (_, i) => ({
    hour: `${(i + 6).toString().padStart(2, '0')}:00`,
    density: trendCounts.length > 0 ? averageCount + Math.floor(Math.random() * 10 - 5) : Math.floor(50 + Math.random() * 200),
  }));

  const tooltipStyle = {
    contentStyle: { background: 'hsl(222, 47%, 7%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px' },
    labelStyle: { color: 'hsl(215, 20%, 65%)' },
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="label-text text-base">Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Line chart */}
        <div className="monitor-card p-4">
          <span className="label-text">People Count Over Time</span>
          <div className="mt-4">
            <CrowdTrendChart data={data.trendData} height={250} />
          </div>
        </div>

        {/* Bar chart */}
        <div className="monitor-card p-4">
          <span className="label-text">Hourly Crowd Density</span>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={hourlyData}>
                <XAxis dataKey="hour" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="density" fill="hsl(150, 100%, 50%)" radius={[2, 2, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart */}
        <div className="monitor-card p-4">
          <span className="label-text">Risk Level Distribution</span>
          <div className="mt-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={effectiveDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" stroke="none">
                  {effectiveDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            {effectiveDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-muted-foreground uppercase">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="monitor-card p-4 flex flex-col gap-6">
          <span className="label-text">Summary Statistics</span>
          {[
            { label: 'Peak Count Today', value: peakCount.toString() },
            { label: 'Average Count', value: averageCount.toString() },
            { label: 'Total Alerts', value: totalAlerts.toString() },
            { label: 'Uptime', value: '100%' },
          ].map((stat) => (
            <div key={stat.label} className="flex justify-between items-baseline border-b border-border/10 pb-3">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className="text-lg data-value text-foreground">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
