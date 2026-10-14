import { Link, NavLink } from "react-router-dom";
import { Tournament } from "../lib/api";

function isClubOperator(role: string | undefined) {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "STAFF";
}

export default function TournamentHeader({
  tournamentId,
  tournamentName,
  tournamentType,
  postId,
  userRole,
}: {
  tournamentId: string;
  tournamentName: string;
  tournamentType?: Tournament["type"];
  postId?: string | null;
  userRole?: string;
}) {
  const base = `/t/${tournamentId}`;
  const operator = isClubOperator(userRole);
  const signedIn = !!userRole;
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-pill whitespace-nowrap ${isActive ? "nav-pill-active" : ""}`;

  return (
    <header className="site-header sticky top-0 z-40 border-b border-white/10 bg-[#070936]/95 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-14 items-center justify-between gap-3">
          <Link to={base} className="min-w-0 truncate font-display text-base font-bold tracking-wide text-white hover:text-ball sm:text-lg" title={tournamentName}>
            {tournamentName}
          </Link>
          <Link to={operator ? "/manage" : "/"} className="secondary-button shrink-0 px-3 py-2 text-xs">
            {operator ? "Back to dashboard" : "Club Lorenzo"}
          </Link>
        </div>
        <nav className="app-navigation flex min-w-0 items-center gap-1 overflow-x-auto border-t border-white/[0.07] py-2" aria-label={`${tournamentName} navigation`}>
          <NavLink to={base} end className={linkClass}>Home</NavLink>
          <NavLink to={`${base}/kiosk`} className={linkClass}>Live board</NavLink>
          <NavLink to={`${base}/leaderboard`} className={linkClass}>Standings</NavLink>
          {operator && <NavLink
            to={`${base}/courts`}
            className={({ isActive }) => `nav-pill inline-flex min-h-11 flex-col items-start justify-center gap-0 whitespace-nowrap border border-ball/30 px-3 py-1 font-semibold leading-tight text-ball ${isActive ? "nav-pill-active" : "bg-ball/[0.06] hover:bg-ball/[0.12]"}`}
            aria-label="Live tournament management: Court control"
          >
            <span className="mr-1.5 text-[9px] uppercase tracking-wider text-ball/65">Live tournament management</span>
            <span>Court control</span>
          </NavLink>}
          {tournamentType === "FIXED_BRACKET" && <NavLink to={`${base}/bracket`} className={linkClass}>Bracket</NavLink>}
          {operator && <NavLink to={`${base}/location`} className={linkClass}>Event location</NavLink>}
          <NavLink to={`${base}/raffle`} className={linkClass}>Raffle</NavLink>
          {signedIn && <NavLink to={`${base}/changes`} className={linkClass}>Activity</NavLink>}
          {postId && <Link to={`/community/${postId}`} className="nav-pill whitespace-nowrap">Event details</Link>}
        </nav>
      </div>
    </header>
  );
}
