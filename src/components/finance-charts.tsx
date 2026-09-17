"use client";

import { formatCurrency } from "@/lib/mock-data";

type Slice = { name: string; value: number; color: string };

function polar(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function arcPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const from = polar(cx, cy, radius, start);
  const to = polar(cx, cy, radius, end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
}

export function CategoryPieChart({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (!total) {
    return <p className="text-sm text-[var(--muted)]">Belum ada pengeluaran pada filter ini.</p>;
  }

  let cursor = -Math.PI / 2;
  const arcs = slices.map((slice) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const path = arcPath(80, 80, 72, cursor, cursor + sweep);
    cursor += sweep;
    return { ...slice, path };
  });

  return (
    <div className="grid gap-5 sm:grid-cols-[160px_1fr] sm:items-center">
      <svg viewBox="0 0 160 160" className="mx-auto h-40 w-40" role="img" aria-label="Pie chart pengeluaran per kategori">
        {arcs.map((arc) => (
          <path key={arc.name} d={arc.path} fill={arc.color} />
        ))}
        <circle cx="80" cy="80" r="42" fill="white" />
        <text x="80" y="76" textAnchor="middle" className="fill-[var(--muted)]" fontSize="9">
          Total
        </text>
        <text x="80" y="94" textAnchor="middle" className="fill-[var(--ink)]" fontSize="10" fontWeight="700">
          {slices.length} kat.
        </text>
      </svg>
      <ul className="space-y-2">
        {arcs.map((arc) => (
          <li key={arc.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 text-[var(--ink)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: arc.color }} />
              {arc.name}
            </span>
            <span className="tabular-nums text-[var(--muted)]">
              {Math.round((arc.value / total) * 100)}% · {formatCurrency(arc.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CashflowChart({
  days,
}: {
  days: { date: string; income: number; expense: number }[];
}) {
  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 12, bottom: 36, left: 12 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...days.flatMap((day) => [day.income, day.expense]), 1);
  const step = days.length > 1 ? innerW / (days.length - 1) : innerW;

  const toPoint = (value: number, index: number) => {
    const x = pad.left + index * step;
    const y = pad.top + innerH - (value / max) * innerH;
    return `${x},${y}`;
  };

  const incomeLine = days.map((day, index) => toPoint(day.income, index)).join(" ");
  const expenseLine = days.map((day, index) => toPoint(day.expense, index)).join(" ");
  const labels = days.filter((_, index) => {
    if (days.length <= 10) return true;
    const interval = Math.ceil(days.length / 7);
    return index % interval === 0 || index === days.length - 1;
  });

  if (!days.length) {
    return <p className="text-sm text-[var(--muted)]">Pilih rentang tanggal untuk melihat arus kas.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full" role="img" aria-label="Grafik arus kas harian">
        <line x1={pad.left} y1={pad.top + innerH} x2={width - pad.right} y2={pad.top + innerH} stroke="#dce6df" />
        <polyline fill="none" stroke="#2f9d78" strokeWidth="2.5" points={incomeLine} />
        <polyline fill="none" stroke="#d8645a" strokeWidth="2.5" points={expenseLine} />
        {days.length <= 31 &&
          days.map((day, index) => {
            const [xIncome, yIncome] = toPoint(day.income, index).split(",");
            const [xExpense, yExpense] = toPoint(day.expense, index).split(",");
            return (
              <g key={day.date}>
                <circle cx={xIncome} cy={yIncome} r="3" fill="#2f9d78" />
                <circle cx={xExpense} cy={yExpense} r="3" fill="#d8645a" />
              </g>
            );
          })}
        {labels.map((day) => {
          const index = days.indexOf(day);
          const x = pad.left + index * step;
          return (
            <text key={day.date} x={x} y={height - 10} textAnchor="middle" fontSize="10" fill="#6f817c">
              {day.date.slice(8)}/{day.date.slice(5, 7)}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[var(--mint)]" /> Pendapatan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[var(--coral)]" /> Pengeluaran
        </span>
      </div>
    </div>
  );
}
