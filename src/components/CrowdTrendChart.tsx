import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';

interface Props {
  data: { time: string; count: number }[];
  height?: number;
}

export function CrowdTrendChart({ data, height = 200 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="crowdGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(150, 100%, 50%)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(150, 100%, 50%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={35}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(222, 47%, 7%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px',
            fontSize: '12px',
          }}
          labelStyle={{ color: 'hsl(215, 20%, 65%)' }}
          itemStyle={{ color: 'hsl(150, 100%, 50%)' }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="hsl(150, 100%, 50%)"
          strokeWidth={2}
          fill="url(#crowdGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
