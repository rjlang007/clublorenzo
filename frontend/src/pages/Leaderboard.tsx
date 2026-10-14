import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, LeaderboardRow } from "../lib/api";
import { useTournamentSocket } from "../lib/socket";
import PageHeader from "../components/PageHeader";

type FinalResult = {
  tournamentName: string;
  finalized: boolean;
  finalizedAt: string | null;
  standings: LeaderboardRow[] | null;
};

const PODIUM_STYLE = {
  1: { card: "podium-rank-1", medal: "podium-medal-1", avatar: "podium-avatar-1" },
  2: { card: "podium-rank-2", medal: "podium-medal-2", avatar: "podium-avatar-2" },
  3: { card: "podium-rank-3", medal: "podium-medal-3", avatar: "podium-avatar-3" },
} as const;

function renderResultsCanvas(tournamentName: string, rows: LeaderboardRow[]): HTMLCanvasElement | null {
  const width = 1400;
  const rowHeight = 64;
  const tableTop = 720;
  const height = tableTop + 54 + rows.length * rowHeight + 72;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#070b3a");
  background.addColorStop(0.55, "#111b69");
  background.addColorStop(1, "#071437");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const court = context.createLinearGradient(0, 0, width, 0);
  court.addColorStop(0, "rgba(113, 138, 255, 0)");
  court.addColorStop(0.5, "rgba(113, 138, 255, 0.16)");
  court.addColorStop(1, "rgba(113, 138, 255, 0)");
  context.fillStyle = court;
  context.fillRect(0, 0, width, 300);
  context.strokeStyle = "rgba(210, 220, 255, 0.1)";
  context.lineWidth = 2;
  [90, 230, 370, 510, 650, 790, 930, 1070, 1210, 1350].forEach((x) => {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - 80, 285);
    context.stroke();
  });

  context.fillStyle = "#ffffff";
  context.font = "700 26px Arial, sans-serif";
  context.fillText("CLUB LORENZO", 72, 64);
  context.fillStyle = "#afc0ff";
  context.font = "400 15px Arial, sans-serif";
  context.fillText("PICKLEBALL  ·  COMMUNITY  ·  COMPETITION", 72, 92);
  context.textAlign = "right";
  context.fillStyle = "#b9c6ff";
  context.font = "700 15px Arial, sans-serif";
  context.fillText("OFFICIAL EVENT RESULTS", width - 72, 64);
  context.textAlign = "left";
  context.fillStyle = "#9eb0ff";
  context.font = "700 17px Arial, sans-serif";
  context.fillText("FINAL STANDINGS", 72, 158);
  context.fillStyle = "#ffffff";
  context.font = "700 62px Arial, sans-serif";
  context.fillText("A day worth celebrating.", 72, 230);
  context.fillStyle = "#d7defd";
  context.font = "400 26px Arial, sans-serif";
  context.fillText(tournamentName, 72, 274);

  const winner = rows[0];
  if (winner) {
    context.fillStyle = "#101947";
    context.beginPath();
    context.roundRect(72, 300, width - 144, 64, 20);
    context.fill();
    context.fillStyle = "#ffdc7b";
    context.beginPath();
    context.arc(115, 332, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#17204f";
    context.font = "700 15px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText("1", 115, 337);
    context.textAlign = "left";
    context.fillStyle = "#ffdc7b";
    context.font = "700 17px Arial, sans-serif";
    context.fillText("TOURNAMENT CHAMPION", 140, 337);
    context.fillStyle = "#ffffff";
    context.font = "700 25px Arial, sans-serif";
    context.fillText(winner.name, 96, 352);
  }

  const podiumRows = [
    { row: rows[1], rank: 2, x: 520, y: 500, height: 150, color: "#c5d5ff", label: "2ND PLACE" },
    { row: rows[0], rank: 1, x: 710, y: 420, height: 230, color: "#ffdc7b", label: "CHAMPION" },
    { row: rows[2], rank: 3, x: 900, y: 505, height: 145, color: "#e4a477", label: "3RD PLACE" },
  ].filter((place): place is typeof place & { row: LeaderboardRow } => !!place.row);
  podiumRows.forEach(({ row, rank, x, y, height: podiumHeight, color, label }) => {
    const cardWidth = 180;
    context.fillStyle = "rgba(255, 255, 255, 0.08)";
    context.beginPath();
    context.roundRect(x, y, cardWidth, podiumHeight, 20);
    context.fill();
    context.strokeStyle = `${color}88`;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = color;
    context.font = "700 17px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(label, x + cardWidth / 2, y + 32);
    context.font = "700 48px Arial, sans-serif";
    context.fillText(String(rank), x + cardWidth / 2, y + 88);
    context.fillStyle = "#ffffff";
    context.font = "700 20px Arial, sans-serif";
    context.fillText(row.name.length > 16 ? `${row.name.slice(0, 15)}…` : row.name, x + cardWidth / 2, y + 120);
    context.fillStyle = "#c8d2ff";
    context.font = "600 14px Arial, sans-serif";
    context.fillText(`${row.wins} W  ·  ${row.losses} L`, x + cardWidth / 2, y + 145);
    context.textAlign = "left";
  });
  context.fillStyle = "rgba(125, 148, 255, 0.24)";
  context.fillRect(475, 650, 620, 3);
  context.fillStyle = "#aab8f5";
  context.font = "600 14px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText("PODIUM", 785, 682);
  context.textAlign = "left";

  context.fillStyle = "rgba(255, 255, 255, 0.1)";
  context.beginPath();
  context.roundRect(72, tableTop, width - 144, 50, 12);
  context.fill();
  context.fillStyle = "#b9c6ff";
  context.font = "700 15px Arial, sans-serif";
  context.fillText("RANK", 98, tableTop + 32);
  context.fillText("PLAYER", 210, tableTop + 32);
  context.fillText("LEVEL", 735, tableTop + 32);
  context.fillText("RECORD", 900, tableTop + 32);
  context.fillText("WIN RATE", 1150, tableTop + 32);

  rows.forEach((row, index) => {
    const y = tableTop + 50 + index * rowHeight;
    context.fillStyle = index % 2 === 0 ? "rgba(255, 255, 255, 0.065)" : "rgba(255, 255, 255, 0.025)";
    context.fillRect(72, y, width - 144, rowHeight);
    context.fillStyle = index === 0 ? "#ffdc7b" : "#ffffff";
    context.font = "700 20px Arial, sans-serif";
    context.fillText(String(index + 1), 100, y + 39);
    context.font = "600 20px Arial, sans-serif";
    context.fillText(row.name.length > 35 ? `${row.name.slice(0, 34)}…` : row.name, 210, y + 39);
    context.fillStyle = "#c8d2ff";
    context.font = "500 17px Arial, sans-serif";
    context.fillText(row.skillLevel, 735, y + 39);
    context.fillText(`${row.wins} W  ·  ${row.losses} L`, 900, y + 39);
    context.fillText(`${row.winPct}%`, 1150, y + 39);
  });

  context.fillStyle = "#aab8f5";
  context.font = "400 15px Arial, sans-serif";
  context.fillText("Club Lorenzo  ·  Pickleball, community, and great games.", 72, height - 28);
  context.textAlign = "right";
  context.fillText("OFFICIAL RESULTS", width - 72, height - 28);
  return canvas;
}

function resultsFilename(tournamentName: string) {
  return `${tournamentName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "tournament"}-results.png`;
}

async function downloadResultsImage(tournamentName: string, rows: LeaderboardRow[]) {
  const canvas = renderResultsCanvas(tournamentName, rows);
  if (!canvas) throw new Error("Could not create the standings image.");
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not create the standings image.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = resultsFilename(tournamentName);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareResultsImage(tournamentName: string, rows: LeaderboardRow[]) {
  const canvas = renderResultsCanvas(tournamentName, rows);
  if (!canvas) throw new Error("Could not create the standings image.");
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not create the standings image.");
  const file = new File([blob], resultsFilename(tournamentName), { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: `${tournamentName} final results`, text: "Club pickleball & community play.", files: [file] });
    return;
  }
  await downloadResultsImage(tournamentName, rows);
}

export default function Leaderboard() {
  const { tournamentId } = useParams();
  const [liveRows, setLiveRows] = useState<LeaderboardRow[]>([]);
  const [final, setFinal] = useState<FinalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    return Promise.all([
      api.get(`/leaderboard/${tournamentId}`),
      api.get(`/leaderboard/${tournamentId}/final`),
    ]).then(([liveResponse, finalResponse]) => {
      setLiveRows(liveResponse.data);
      setFinal(finalResponse.data);
    }).catch(() => setError("Results are temporarily unavailable.")).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [tournamentId]);
  useTournamentSocket(tournamentId, ["games:changed", "tournament:changed"], load);

  const isFinal = !!final?.finalized;
  const rows = isFinal && final?.standings ? final.standings : liveRows;
  const podiumRows = rows.slice(0, 3);
  const totalGames = rows.reduce((sum, row) => sum + row.gamesPlayed, 0);
  const leader = rows[0];
  const topWinRate = rows.reduce((best, row) => (row.winPct > best.winPct ? row : best), rows[0] ?? { winPct: 0, name: "—" } as LeaderboardRow);
  const exportName = final?.tournamentName ?? "Club Lorenzo";
  const onShareResults = async () => {
    setShareError(null);
    try {
      await shareResultsImage(exportName, rows);
    } catch (shareFailure: unknown) {
      if (!(shareFailure instanceof DOMException && shareFailure.name === "AbortError")) {
        setShareError("Could not share the results image.");
      }
    }
  };
  const onSaveResults = async () => {
    setShareError(null);
    try {
      await downloadResultsImage(exportName, rows);
    } catch {
      setShareError("Could not create the standings image. Please try again.");
    }
  };

  return (
    <div className="leaderboard-page mx-auto max-w-5xl space-y-6">
      <PageHeader eyebrow="Tournament results" title={isFinal ? "Final standings" : "Leaderboard"} actions={
        <div className="leaderboard-actions flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => window.print()} className="secondary-button px-3 py-2 text-xs">Print standings</button>
          <button type="button" onClick={() => void onSaveResults()} disabled={rows.length === 0} className="secondary-button px-3 py-2 text-xs">Save PNG</button>
          <button type="button" onClick={onShareResults} disabled={rows.length === 0} className="action-button px-3 py-2 text-xs">Share results</button>
          {isFinal && final?.finalizedAt && (
            <div className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-red-300">
              Recorded {new Date(final.finalizedAt).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </div>
          )}
        </div>
      } />

      {error && <div className="error-panel flex flex-wrap items-center justify-between gap-3">{error}<button type="button" onClick={load} className="secondary-button px-3 py-1.5 text-xs">Retry</button></div>}
      {shareError && <p role="alert" className="text-sm text-advance">{shareError}</p>}

      {loading ? <LeaderboardSkeleton /> : <>

      {isFinal && final?.standings && (
        <section className="final-results-banner overflow-hidden rounded-3xl border border-ball/30 bg-gradient-to-br from-ball/20 via-white/5 to-emerald-500/10 p-6 shadow-2xl shadow-ball/10 sm:p-8">
          <div className="max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-ball">Official tournament results</div>
            <h2 className="mt-3 font-display text-4xl font-bold text-white sm:text-5xl">Congratulations to {leader?.name ?? "our players"}!</h2>
            <p className="mt-3 text-base leading-7 text-white/70">The tournament is complete. Here are the final rankings, including every player who competed.</p>
          </div>
        </section>
      )}

      {podiumRows.length > 0 && <section className="podium-stage" aria-label="Top three standings">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-ball">The podium</div>
            <h3 className="mt-2 font-display text-3xl font-bold text-white">{isFinal ? "Your event champions" : "Top of the leaderboard"}</h3>
          </div>
          <div className="hidden text-right text-xs leading-5 text-white/45 sm:block">{isFinal ? "Official final placements" : "Live standings · Updates as results are recorded"}</div>
        </div>
        <div className="podium-grid">
          {podiumRows.map((row, index) => {
            const rank = index + 1;
            const style = PODIUM_STYLE[rank as keyof typeof PODIUM_STYLE];
            return <article key={row.playerId} className={`podium-card ${style.card}`}>
              <div className="podium-card-top">
                <div className={`podium-medal-art ${style.medal}`} aria-hidden="true">
                  <span>{rank}</span>
                </div>
                <span className="podium-rank">{rank === 1 ? "CHAMPION" : `${rank}${rank === 2 ? "ND" : "RD"} PLACE`}</span>
              </div>
              <div className="podium-player">
                <div className={`podium-avatar ${style.avatar}`}>{row.name.trim().charAt(0).toUpperCase()}</div>
                <h4 className="truncate font-display text-xl font-bold text-white sm:text-2xl">{row.name}</h4>
                <span className="podium-player-level">{row.skillLevel}</span>
              </div>
              <div className="podium-stats">
                <div className="podium-stat">
                  <span className="podium-stat-value">{row.wins}<small>W</small> <span aria-hidden="true">·</span> {row.losses}<small>L</small></span>
                  <span className="podium-stat-label">Match record</span>
                </div>
                <div className="podium-stat podium-stat-right">
                  <span className="podium-stat-value">{row.winPct}%</span>
                  <span className="podium-stat-label">Win rate</span>
                </div>
              </div>
              <div className="podium-plinth" aria-hidden="true">
                <span>{rank}</span>
                <i />
                <i />
                <i />
              </div>
            </article>;
          })}
        </div>
      </section>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Current leader</div>
          <div className="mt-3 font-display text-2xl font-bold text-ball">{leader ? leader.name : "—"}</div>
          <div className="mt-1 text-sm text-white/60">{leader ? `${leader.wins} wins • ${leader.losses} losses` : "No results yet"}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Games played</div>
          <div className="mt-3 font-display text-2xl font-bold text-white">{totalGames}</div>
          <div className="mt-1 text-sm text-white/60">Total recorded matches</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Best win rate</div>
          <div className="mt-3 font-display text-2xl font-bold text-emerald-300">{topWinRate.name}</div>
          <div className="mt-1 text-sm text-white/60">{Math.round(topWinRate.winPct)}% win percentage</div>
        </div>
      </div>

      {isFinal && (
        <p className="text-sm text-white/55">
          These results are officially locked in. If the operator extends the tournament, this page will switch back to live standings.
        </p>
      )}

      <section className="glass-panel mobile-data-table overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/[0.02]">
            <tr className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3 text-center">Games</th>
              <th className="px-4 py-3 text-center">W</th>
              <th className="px-4 py-3 text-center">L</th>
              <th className="px-4 py-3 text-center">Win %</th>
              <th className="px-4 py-3 text-center">Points</th>
              <th className="px-4 py-3 text-center">Loss pts</th>
              <th className="px-4 py-3 text-center">Point diff</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.playerId} className="border-t border-white/10">
                <td className="px-4 py-3 text-white/65">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">{r.name}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`skill-badge-${r.skillLevel} rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em]`}>
                    {r.skillLevel}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-white/80">{r.gamesPlayed}</td>
                <td className="px-4 py-3 text-center font-bold text-emerald-300">{r.wins}</td>
                <td className="px-4 py-3 text-center font-bold text-red-300">{r.losses}</td>
                <td className="px-4 py-3 text-center text-white/80">{r.winPct}%</td>
                <td className="px-4 py-3 text-center text-white/80">{r.pointsFor}</td>
                <td className="px-4 py-3 text-center text-orange-200">{r.lossPoints}</td>
                <td className="px-4 py-3 text-center text-white/80">{r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && <p className="p-4 text-sm text-white/45">No results yet.</p>}
      </section>
      </>}
    </div>
  );
}

function LeaderboardSkeleton() {
  return <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="glass-panel h-28 p-4"><div className="skeleton h-3 w-24" /><div className="skeleton mt-5 h-7 w-32" /></div>)}</div>
    <div className="glass-panel space-y-3 p-5">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-10 w-full" />)}</div>
  </div>;
}
