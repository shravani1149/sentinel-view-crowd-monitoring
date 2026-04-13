import { useCrowdData } from '@/hooks/useCrowdDataStandalone';
import { RiskBadge } from '@/components/RiskBadge';

const Alerts = () => {
  const { data } = useCrowdData();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="label-text text-base">Alert Center</h1>
        <span className="text-[10px] font-mono text-primary">
          {data.alerts.filter(a => a.triggered).length} ACTIVE ALERTS
        </span>
      </div>

      <div className="monitor-card p-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-muted-foreground/40 border-b border-border/20">
              <tr>
                <th className="pb-3 font-medium">TIMESTAMP</th>
                <th className="pb-3 font-medium">PEOPLE COUNT</th>
                <th className="pb-3 font-medium">RISK LEVEL</th>
                <th className="pb-3 font-medium text-right">ALERT TRIGGERED</th>
              </tr>
            </thead>
            <tbody>
              {data.alerts.map((alert, i) => (
                <tr key={i} className="border-b border-border/10">
                  <td className="py-3 text-foreground/70">{alert.timestamp}</td>
                  <td className="py-3 data-value text-foreground">{alert.count}</td>
                  <td className="py-3">
                    <RiskBadge risk={alert.risk} size="sm" />
                  </td>
                  <td className="py-3 text-right">
                    {alert.triggered ? (
                      <span className="text-destructive font-bold">YES</span>
                    ) : (
                      <span className="text-muted-foreground">NO</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Alerts;
