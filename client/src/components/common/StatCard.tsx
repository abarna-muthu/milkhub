import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  highlightColor?: 'default' | 'green' | 'amber' | 'blue';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  highlightColor = 'default',
  className = '',
}) => {
  const borderHighlight =
    highlightColor === 'green'
      ? 'border-l-4 border-l-brand-800'
      : highlightColor === 'amber'
      ? 'border-l-4 border-l-amber-600'
      : highlightColor === 'blue'
      ? 'border-l-4 border-l-sky-600'
      : 'border-l-4 border-l-brand-600';

  return (
    <div
      className={`bg-white border border-slate-200 rounded-md p-4 shadow-subtle flex flex-col justify-between ${borderHighlight} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className="p-1.5 rounded bg-slate-50 text-slate-700 shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            {trend && (
              <span
                className={`font-semibold ${
                  trend.isPositive ? 'text-emerald-700' : 'text-slate-600'
                }`}
              >
                {trend.value}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
