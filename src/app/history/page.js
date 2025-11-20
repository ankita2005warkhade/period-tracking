"use client";

import { useEffect, useState, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import Link from "next/link";

/* -------------------------------------------
   SIMPLE SVG LINE CHART
------------------------------------------- */
function LineChart({ data = [], labels = [], height = 120, color = "#ff4fa3" }) {
  if (!data.length)
    return (
      <div style={{ height, display: "flex", alignItems: "center" }}>
        No data
      </div>
    );

  const padding = 10;
  const w = Math.max(220, data.length * 40);
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = padding + (i * (w - padding * 2)) / (data.length - 1 || 1);
    const y = padding + ((max - v) * (h - padding * 2)) / range;
    return `${x},${y}`;
  });

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMinYMid meet">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <polyline
        points={`${points.join(" ")} ${w - padding},${h - padding} ${padding},${h - padding}`}
        fill="url(#g)"
      />

      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {points.map((pt, i) => {
        const [cx, cy] = pt.split(",").map(Number);
        return <circle key={i} cx={cx} cy={cy} r={3.3} fill={color} />;
      })}
    </svg>
  );
}

/*===========================================
   MAIN COMPONENT
===========================================*/

export default function HistoryPage() {
  const [user, setUser] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);

  /* WATCH AUTH */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  /* FETCH CYCLES */
  useEffect(() => {
    if (!user) {
      setCycles([]);
      setLoading(false);
      return;
    }

    const fetchCycles = async () => {
      setLoading(true);

      const cyclesRef = collection(db, "users", user.uid, "cycles");
      const q = query(cyclesRef, orderBy("startDate", "desc"));
      const snap = await getDocs(q);

      const arr = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt:
          d.data().createdAt?.toDate?.() ??
          (d.data().createdAt?.seconds
            ? new Date(d.data().createdAt.seconds * 1000)
            : null),
      }));

      const completed = arr.filter((c) => c.endDate);

      // oldest → newest (for graph)
      completed.sort((a, b) => {
        return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
      });

      setCycles(completed);
      setLoading(false);
    };

    fetchCycles();
  }, [user]);

  /* -------------------------------------------
     COMPUTED STATISTICS
  ------------------------------------------- */
  const stats = useMemo(() => {
    if (!cycles.length) {
      return {
        avgLength: 0,
        avgHealth: 0,
        nextPredictedDate: null,
        lengths: [],
        healths: [],
        labels: [],
      };
    }

    const lengths = cycles.map((c) => c.cycleLength || 0);
    const healths = cycles.map((c) => c.cycleHealthScore || 0);

    const labels = cycles.map((c) =>
      new Date(c.startDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );

    return {
      avgLength:
        Math.round(
          (lengths.reduce((a, b) => a + b, 0) / lengths.length) * 10
        ) / 10,
      avgHealth: Math.round(
        healths.reduce((a, b) => a + b, 0) / healths.length
      ),
      nextPredictedDate: cycles[cycles.length - 1]?.nextPredictedDate ?? "—",
      lengths,
      healths,
      labels,
    };
  }, [cycles]);

  /* -------------------------------------------
     DOWNLOAD PDF REPORT (ALL CYCLES)
  ------------------------------------------- */
  const downloadPDF = async () => {
    if (!cycles.length) return;

    const payload = {
      appName: "Period Tracking",
      brandColor: "#3b3b98", // professional deep purple-blue
      accentColor: "#2a9d8f", // medical green
      cycles: cycles.map((c) => ({
        startDate: c.startDate,
        endDate: c.endDate,
        cycleLength: c.cycleLength,
        cycleHealthScore: c.cycleHealthScore,
        nextPredictedDate: c.nextPredictedDate,
        topMood: c.topMood || "",
        topSymptom: c.topSymptom || "",
        shortSummary: (c.summaryText || "").slice(0, 250),
        specialNotes: c.specialNotes || "",
      })),
    };

    const res = await fetch("/api/generateReport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Failed to generate report");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cycle_report.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* -------------------------------------------
     CSV (Your existing function)
  ------------------------------------------- */
  const downloadCSV = () => {
    if (!cycles.length) return;

    const header = [
      "cycleId",
      "startDate",
      "endDate",
      "cycleLength",
      "cycleHealthScore",
      "nextPredictedDate",
      "summaryText",
    ];
    const rows = cycles.map((c) => [
      c.id,
      c.startDate,
      c.endDate,
      c.cycleLength,
      c.cycleHealthScore,
      c.nextPredictedDate,
      (c.summaryText || "").replace(/\n/g, " "),
    ]);

    const csv =
      [header, ...rows]
        .map((r) => r.map((v) => `"${v}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cycles.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* -------------------------------------------
     UI STARTS HERE
  ------------------------------------------- */

  return (
    <div style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, marginBottom: 12 }}>📊 Cycle History Dashboard</h1>

      {loading && <p>Loading...</p>}
      {!loading && !user && <p>Please login to view your history.</p>}

      {/* Empty message */}
      {!loading && user && cycles.length === 0 && (
        <div
          style={{
            background: "#fff4f7",
            padding: 20,
            borderRadius: 10,
            marginTop: 20,
          }}
        >
          <p>No completed cycles yet.</p>
          <Link href="/log-period">
            <button style={{ padding: "8px 12px", background: "#ff4fa3", color: "white" }}>
              Start a Cycle
            </button>
          </Link>
        </div>
      )}

      {/* If cycles exist */}
      {user && cycles.length > 0 && (
        <>
          {/* TOP STATS */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard title="Avg Cycle Length" value={`${stats.avgLength} days`} />
            <StatCard title="Avg Cycle Health" value={`${stats.avgHealth}%`} />
            <StatCard title="Next Expected Period" value={stats.nextPredictedDate} />

            {/* PDF + CSV buttons */}
            <div
              style={{
                flex: "1 1 180px",
                background: "#fff",
                padding: 16,
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              <button
                onClick={downloadPDF}
                style={{
                  background: "#3b3b98",
                  color: "white",
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "none",
                  marginBottom: 8,
                }}
              >
                📄 Download PDF
              </button>

              <button
                onClick={downloadCSV}
                style={{
                  background: "#ff4fa3",
                  color: "white",
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "none",
                }}
              >
                ⬇️ CSV
              </button>
            </div>
          </div>

          {/* GRAPHS */}
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <ChartCard title="Cycle Length Trend">
              <LineChart
                data={stats.lengths}
                labels={stats.labels}
                height={140}
                color="#ff7cc2"
              />
            </ChartCard>

            <ChartCard title="Health Score Trend">
              <LineChart
                data={stats.healths}
                labels={stats.labels}
                height={140}
                color="#ff4fa3"
              />
            </ChartCard>
          </div>

          {/* CYCLE LIST */}
          <h2 style={{ marginTop: 28 }}>Completed Cycles</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {cycles.map((c) => (
              <CycleCard key={c.id} cycle={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------
   SMALL COMPONENTS
------------------------------------------- */
function StatCard({ title, value }) {
  return (
    <div
      style={{
        flex: "1 1 230px",
        background: "#fff",
        padding: 16,
        borderRadius: 12,
      }}
    >
      <div style={{ color: "#ff4fa3", fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 26, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div
      style={{
        flex: "1 1 420px",
        background: "#fff",
        padding: 16,
        borderRadius: 12,
      }}
    >
      <div style={{ color: "#c2187a", fontWeight: 700, marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function CycleCard({ cycle }) {
  return (
    <div
      style={{
        background: "#fff",
        padding: 14,
        borderRadius: 12,
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <div style={{ flex: 1, paddingRight: 12 }}>
        <div style={{ fontWeight: 700, color: "#d63384" }}>
          {new Date(cycle.startDate).toDateString()} →{" "}
          {new Date(cycle.endDate).toDateString()}
        </div>

        <div style={{ color: "#666", marginTop: 6 }}>
          {cycle.cycleLength} days · Health: {cycle.cycleHealthScore}%
        </div>

        <p style={{ color: "#444", marginTop: 8 }}>
          {(cycle.summaryText || "").slice(0, 200)}
          {cycle.summaryText?.length > 200 ? "..." : ""}
        </p>
      </div>

      <div style={{ textAlign: "right", minWidth: 150 }}>
        <div style={{ fontSize: 13, color: "#666" }}>Next Expected</div>
        <div style={{ fontWeight: "700", marginTop: 4 }}>
          {cycle.nextPredictedDate || "—"}
        </div>

        <Link href={`/history/${cycle.id}`}>
          <button
            style={{
              marginTop: 10,
              padding: "8px 10px",
              borderRadius: 8,
              border: "none",
              background: "#ff7aa2",
              color: "#fff",
            }}
          >
            View Details
          </button>
        </Link>
      </div>
    </div>
  );
}
