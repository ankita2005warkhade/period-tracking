"use client";

import { useEffect, useState, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import Link from "next/link";

/**
 * Simple line chart using SVG.
 * props.data = array of numbers
 * props.labels = array of labels (same length)
 */
function LineChart({ data = [], labels = [], height = 120, color = "#ff4fa3" }) {
  if (!data.length) return <div style={{ height, display: "flex", alignItems: "center" }}>No data</div>;

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

  // small ticks labels (first + last)
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMinYMid meet">
      {/* grid lines */}
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* area under line (smooth poly not used for simplicity) */}
      <polyline
        points={`${points.join(" ")} ${w - padding},${h - padding} ${padding},${h - padding}`}
        fill="url(#g)"
        stroke="none"
      />

      {/* line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* dots */}
      {points.map((pt, idx) => {
        const [cx, cy] = pt.split(",").map(Number);
        return <circle key={idx} cx={cx} cy={cy} r={3.5} fill={color} />;
      })}

      {/* small labels - only first and last to keep it clean */}
      {labels.length > 0 && (
        <>
          <text x={padding} y={h - 2} fontSize="8" fill="#666">
            {labels[0]}
          </text>
          <text x={w - padding - 40} y={h - 2} fontSize="8" fill="#666">
            {labels[labels.length - 1]}
          </text>
        </>
      )}
    </svg>
  );
}

export default function HistoryPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // wait for auth
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setCycles([]);
      setLoading(false);
      return;
    }

    const fetchCycles = async () => {
      setLoading(true);
      setError("");

      try {
        // fetch cycles collection for current user and order by startDate desc
        const cyclesRef = collection(db, "users", user.uid, "cycles");
        const q = query(cyclesRef, orderBy("startDate", "desc"));
        const snap = await getDocs(q);

        const arr = snap.docs.map((d) => {
          const data = d.data();
          // normalize createdAt and dates
          const createdAt = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : null);
          return {
            id: d.id,
            ...data,
            createdAt,
          };
        });

        // filter completed cycles only (endDate must exist / non-empty)
        const completed = arr.filter((c) => c.endDate && String(c.endDate).trim() !== "");
        // sort by createdAt ascending for charts (older -> newer)
        completed.sort((a, b) => {
          const ta = a.createdAt ? a.createdAt.getTime() : 0;
          const tb = b.createdAt ? b.createdAt.getTime() : 0;
          return ta - tb;
        });

        setCycles(completed);
      } catch (err) {
        console.error("🔥 fetchCycles error:", err);
        setError("Failed to fetch cycles.");
      } finally {
        setLoading(false);
      }
    };

    fetchCycles();
  }, [user]);

  // derived stats
  const stats = useMemo(() => {
    if (!cycles.length) {
      return {
        avgLength: 0,
        avgHealth: 0,
        nextPredictedDate: null,
        lengths: [],
        lengthLabels: [],
        healths: [],
        healthLabels: [],
      };
    }

    const lengths = cycles.map((c) => Number(c.cycleLength || 0));
    const healths = cycles.map((c) => Number(c.cycleHealthScore || 0));
    const labels = cycles.map((c) => {
      try {
        return new Date(c.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      } catch {
        return c.startDate;
      }
    });

    const avgLength = Math.round((lengths.reduce((s, v) => s + v, 0) / (lengths.length || 1)) * 10) / 10;
    const avgHealth = Math.round((healths.reduce((s, v) => s + v, 0) / (healths.length || 1)));

    // next predicted date from the most recent cycle (by createdAt)
    const sortedByCreated = [...cycles].sort((a, b) => {
      const ta = a.createdAt ? a.createdAt.getTime() : 0;
      const tb = b.createdAt ? b.createdAt.getTime() : 0;
      return tb - ta;
    });
    const nextPredictedDate = sortedByCreated[0]?.nextPredictedDate || null;

    return {
      avgLength,
      avgHealth,
      nextPredictedDate,
      lengths,
      lengthLabels: labels,
      healths,
      healthLabels: labels,
    };
  }, [cycles]);

  // CSV download
  const downloadCSV = () => {
    if (!cycles.length) return;
    const header = ["cycleId", "startDate", "endDate", "cycleLength", "cycleHealthScore", "nextPredictedDate", "summaryText"];
    const rows = cycles.map((c) => [
      c.id,
      c.startDate,
      c.endDate,
      c.cycleLength ?? "",
      c.cycleHealthScore ?? "",
      c.nextPredictedDate ?? "",
      (c.summaryText || "").replace(/\r?\n/g, " "),
    ]);

    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cycles_history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 22, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>📊 Cycle History Dashboard</h1>

      {!user && <p style={{ color: "#666" }}>You must be logged in to see cycle history.</p>}

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && user && cycles.length === 0 && (
        <div style={{ padding: 18, background: "#fff8f9", borderRadius: 8 }}>
          <p style={{ margin: 0 }}>No completed cycles yet. Log a cycle to see history here.</p>
          <Link href="/log-period"><button style={{ marginTop: 10, padding: "8px 12px", background: "#ff4fa3", color: "white", border: "none", borderRadius: 8 }}>Start a Cycle</button></Link>
        </div>
      )}

      {!loading && cycles.length > 0 && (
        <>
          {/* top stat cards */}
          <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
              <div style={{ color: "#ff4fa3", fontWeight: 700 }}>Avg cycle length</div>
              <div style={{ fontSize: 28, marginTop: 8 }}>{stats.avgLength} days</div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 6 }}>Based on {cycles.length} completed cycles</div>
            </div>

            <div style={{ flex: "1 1 220px", background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
              <div style={{ color: "#ff4fa3", fontWeight: 700 }}>Avg cycle health</div>
              <div style={{ fontSize: 28, marginTop: 8 }}>{stats.avgHealth}%</div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 6 }}>Higher is better — lower means irregular/many symptoms</div>
            </div>

            <div style={{ flex: "1 1 220px", background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
              <div style={{ color: "#ff4fa3", fontWeight: 700 }}>Next predicted period</div>
              <div style={{ fontSize: 20, marginTop: 8 }}>{stats.nextPredictedDate || "—"}</div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 6 }}>From latest completed cycle</div>
            </div>

            <div style={{ flex: "0 0 160px", background: "#fff", padding: 12, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <button onClick={downloadCSV} style={{ background: "#ff4fa3", color: "#fff", border: "none", padding: "10px 12px", borderRadius: 8, cursor: "pointer" }}>
                Download CSV
              </button>
            </div>
          </div>

          {/* charts */}
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 420px", background: "#fff", padding: 14, borderRadius: 12 }}>
              <div style={{ color: "#d63384", fontWeight: 700, marginBottom: 8 }}>Cycle Length Trend</div>
              <LineChart data={stats.lengths} labels={stats.lengthLabels} height={130} color="#ff7cc2" />
            </div>

            <div style={{ flex: "1 1 420px", background: "#fff", padding: 14, borderRadius: 12 }}>
              <div style={{ color: "#d63384", fontWeight: 700, marginBottom: 8 }}>Health Score Trend</div>
              <LineChart data={stats.healths} labels={stats.healthLabels} height={130} color="#ff4fa3" />
            </div>
          </div>

          {/* cycles list */}
          <div style={{ marginTop: 20 }}>
            <h2 style={{ marginBottom: 10 }}>Completed cycles</h2>

            <div style={{ display: "grid", gap: 12 }}>
              {cycles.map((c) => (
                <div key={c.id} style={{ background: "#fff", padding: 14, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#c2187a" }}>
                      {new Date(c.startDate).toDateString?.() || c.startDate} → {new Date(c.endDate).toDateString?.() || c.endDate}
                    </div>
                    <div style={{ color: "#666", marginTop: 6, fontSize: 14 }}>
                      {c.cycleLength ? `${c.cycleLength} days` : "Length: —"} · Health: {c.cycleHealthScore ?? "—"}%
                    </div>
                    {c.summaryText && <p style={{ marginTop: 8, whiteSpace: "pre-line", color: "#444" }}>{c.summaryText.slice(0, 220)}{c.summaryText.length > 220 ? "..." : ""}</p>}
                  </div>

                  <div style={{ minWidth: 160, textAlign: "right" }}>
                    <div style={{ fontSize: 13, color: "#666" }}>Predicted next</div>
                    <div style={{ marginTop: 6, fontWeight: 700 }}>{c.nextPredictedDate || "—"}</div>
                    <div style={{ marginTop: 12 }}>
                      <Link href={`/history/${c.id}`}><button style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#ff7aa2", color: "#fff", cursor: "pointer" }}>View details</button></Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
