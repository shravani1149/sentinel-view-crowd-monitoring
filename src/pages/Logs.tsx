import { useCrowdData } from '@/hooks/useCrowdDataStandalone';

const Logs = () => {
  const { data } = useCrowdData();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="label-text text-base">System Logs</h1>
        <span className="text-[10px] font-mono text-primary">RECORDING</span>
      </div>

      <div className="monitor-card p-4 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-muted-foreground/40 border-b border-border/20 sticky top-0 bg-surface">
              <tr>
                <th className="pb-3 font-medium">TIMESTAMP</th>
                <th className="pb-3 font-medium">PEOPLE COUNT</th>
                <th className="pb-3 font-medium">SYSTEM STATUS</th>
                <th className="pb-3 font-medium text-right">ALERT TRIGGERED</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log, i) => (
                <tr key={i} className="border-b border-border/10">
                  <td className="py-3 text-foreground/70">{log.timestamp}</td>
                  <td className="py-3 data-value text-foreground">{log.count}</td>
                  <td className="py-3">
                    <span className={log.status === 'OK' ? 'text-primary' : 'text-warning'}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3 text-right text-muted-foreground">
                    {log.status === 'WARNING' ? 'YES' : 'NO'}
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

export default Logs;
