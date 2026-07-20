import { useEffect, useRef, useState } from 'react';

function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setInView(true); });
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export function BarChart({ data, height = 180, color = '#E53935' }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div ref={ref} className="flex items-end justify-between gap-2.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
          <div className="relative w-full flex items-end justify-center" style={{ height: height - 28 }}>
            <div
              className="w-full max-w-[34px] rounded-lg transition-all duration-700 ease-out group-hover:opacity-80"
              style={{
                height: inView ? `${(d.value / max) * 100}%` : '0%',
                background: color,
                transitionDelay: `${i * 60}ms`,
              }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-ink-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1.5 py-0.5 rounded-md shadow-soft border border-ink-200/60 whitespace-nowrap">
                {d.value}%
              </div>
            </div>
          </div>
          <span className="text-[11px] text-ink-500 font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ data, height = 180, color = '#E53935', area = true }: { data: { label: string; value: number }[]; height?: number; color?: string; area?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const w = 560;
  const h = height;
  const pad = { l: 8, r: 8, t: 16, b: 24 };
  const max = Math.max(...data.map((d) => d.value)) * 1.1;
  const min = Math.min(...data.map((d) => d.value)) * 0.85;
  const range = max - min || 1;
  const stepX = (w - pad.l - pad.r) / (data.length - 1 || 1);
  const points = data.map((d, i) => {
    const x = pad.l + i * stepX;
    const y = pad.t + (1 - (d.value - min) / range) * (h - pad.t - pad.b);
    return [x, y];
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${path} L${points[points.length - 1][0]},${h - pad.b} L${points[0][0]},${h - pad.b} Z`;
  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} style={{ opacity: inView ? 1 : 0, transition: 'opacity 0.8s ease' }} />}
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 2000, strokeDashoffset: inView ? 0 : 2000, transition: 'stroke-dashoffset 1s ease' }} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r="3.5" fill="white" stroke={color} strokeWidth="2"
              style={{ opacity: inView ? 1 : 0, transition: `opacity 0.4s ease ${i * 80}ms` }} />
            <text x={p[0]} y={h - 6} textAnchor="middle" className="fill-ink-500" style={{ fontSize: 11 }}>{data[i].label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function RadarChart({ labels, values, size = 280, color = '#E53935' }: { labels: string[]; values: number[]; size?: number; color?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 36;
  const n = labels.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, radius: number) => [cx + Math.cos(angle(i)) * radius, cy + Math.sin(angle(i)) * radius];
  const dataPath = values.map((v, i) => {
    const [x, y] = point(i, (r * v) / 10);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';
  const grid = [2, 4, 6, 8, 10];
  return (
    <div ref={ref} className="flex justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
        {grid.map((g) => (
          <polygon key={g} points={labels.map((_, i) => point(i, (r * g) / 10).join(',')).join(' ')}
            fill="none" stroke="#E2E8F0" strokeWidth="1" />
        ))}
        {labels.map((_, i) => {
          const [x, y] = point(i, r);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E2E8F0" strokeWidth="1" />;
        })}
        <path d={dataPath} fill={color} fillOpacity={inView ? 0.18 : 0} stroke={color} strokeWidth="2"
          style={{ transition: 'fill-opacity 0.8s ease' }} />
        {values.map((v, i) => {
          const [x, y] = point(i, (r * v) / 10);
          return <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke={color} strokeWidth="2"
            style={{ opacity: inView ? 1 : 0, transition: `opacity 0.4s ease ${i * 60}ms` }} />;
        })}
        {labels.map((l, i) => {
          const [x, y] = point(i, r + 18);
          return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-ink-600" style={{ fontSize: 11, fontWeight: 500 }}>{l}</text>;
        })}
      </svg>
    </div>
  );
}

export function DonutChart({ segments, size = 160, thickness = 18 }: { segments: { value: number; color: string; label: string }[]; size?: number; thickness?: number }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div ref={ref} className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${inView ? len : 0} ${c}`} strokeDashoffset={-offset} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.9s ease' }} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-ink-900">{total}%</span>
        <span className="text-[11px] text-ink-500">Attendance</span>
      </div>
    </div>
  );
}

export function Sparkline({ data, color = '#E53935', height = 36, width = 96 }: { data: number[]; color?: string; height?: number; width?: number }) {
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1 || 1);
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
