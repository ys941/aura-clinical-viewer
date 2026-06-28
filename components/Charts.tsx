"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { stroke: "#475569", fontSize: 11, tickLine: false, axisLine: false };
const tooltipStyle = {
  background: "#0d1530",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e2e8f0",
};

export function TurnaroundChart({
  data,
}: {
  data: { day: string; tat: number; target: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="day" {...axis} />
        <YAxis {...axis} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
        <Line
          type="monotone"
          dataKey="target"
          stroke="#475569"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="tat"
          stroke="#2dd4bf"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#2dd4bf" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function VolumeChart({
  data,
}: {
  data: { month: string; studies: number; reports: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gStudies" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f97ff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#4f97ff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gReports" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="month" {...axis} />
        <YAxis {...axis} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(255,255,255,0.1)" }} />
        <Area
          type="monotone"
          dataKey="studies"
          stroke="#4f97ff"
          strokeWidth={2}
          fill="url(#gStudies)"
        />
        <Area
          type="monotone"
          dataKey="reports"
          stroke="#2dd4bf"
          strokeWidth={2}
          fill="url(#gReports)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ModalityDonut({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
