import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface TrendChartProps {
  data: Record<string, unknown>[];
  expanded?: boolean;
}

const chartPresentation = {
  compact: {
    tickSize: 10,
    axisColor: '#94a3b8',
    strokeWidth: 3,
    dotRadius: 4,
    activeDotRadius: 6,
    tooltip: {
      borderRadius: '8px',
      border: 'none',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
  },
  expanded: {
    tickSize: 12,
    axisColor: '#64748b',
    strokeWidth: 4,
    dotRadius: 6,
    activeDotRadius: 8,
    tooltip: {
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    },
  },
};

function ArchiveLineChart({
  data, expanded = false, dataKey, color, name,
}: TrendChartProps & { dataKey: string; color: string; name?: string }) {
  const style = chartPresentation[expanded ? 'expanded' : 'compact'];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="dateStr" tick={{ fontSize: style.tickSize }} tickMargin={style.tickSize} stroke={style.axisColor} />
        <YAxis tick={{ fontSize: style.tickSize }} stroke={style.axisColor} />
        <Tooltip contentStyle={style.tooltip} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
        <Line
          type="monotone"
          dataKey={dataKey}
          {...(name === undefined ? {} : { name })}
          stroke={color}
          strokeWidth={style.strokeWidth}
          dot={{ r: style.dotRadius }}
          activeDot={{ r: style.activeDotRadius }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AttendanceTrendChart({
  data, metric, expanded = false,
}: TrendChartProps & { metric: 'count' | 'rate' }) {
  return (
    <ArchiveLineChart
      data={data}
      dataKey={metric}
      color="#10b981"
      name={metric === 'count' ? '인원 (명)' : '참석률 (%)'}
      expanded={expanded}
    />
  );
}

export function NewcomerTrendChart({
  data, normalize, expanded = false,
}: TrendChartProps & { normalize: boolean }) {
  if (normalize) {
    return <ArchiveLineChart data={data} dataKey="보정지수" color="#6366f1" expanded={expanded} />;
  }

  const style = chartPresentation[expanded ? 'expanded' : 'compact'];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} {...(expanded ? { margin: { top: 20, right: 30, left: 20, bottom: 5 } } : {})}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="dateStr" tick={{ fontSize: style.tickSize }} tickMargin={style.tickSize} stroke={style.axisColor} />
        <YAxis tick={{ fontSize: style.tickSize }} stroke={style.axisColor} />
        <Tooltip contentStyle={style.tooltip} labelStyle={{ fontWeight: 'bold', color: '#1e293b' }} />
        <Legend wrapperStyle={{ fontSize: `${style.tickSize}px`, fontWeight: 'bold', ...(expanded ? { paddingTop: '20px' } : {}) }} />
        <Bar dataKey="신입" stackId="a" fill="#3b82f6" {...(expanded ? { radius: [0, 0, 4, 4] as [number, number, number, number] } : {})} />
        <Bar dataKey="기존" stackId="a" fill="#cbd5e1" {...(expanded ? { radius: [4, 4, 0, 0] as [number, number, number, number] } : {})} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StagnationChart({ data, expanded = false }: TrendChartProps) {
  return <ArchiveLineChart data={data} dataKey="정체성지수" color="#f43f5e" expanded={expanded} />;
}
