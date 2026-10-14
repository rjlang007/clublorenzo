import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, fileUrl } from "../lib/api";
import { clubLorenzo } from "../lib/clubLorenzo";
import { DEFAULT_SITE_CONTENT, type SiteContent } from "../lib/siteContent";

function isClubOperator(role: string | undefined) {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "STAFF";
}

function isSiteAdmin(role: string | undefined) {
  return role === "SUPERADMIN" || role === "ADMIN";
}

export default function AppHeader({ tournamentId, unreadCount = 0 }: { tournamentId?: string; unreadCount?: number }) {
  const { user, logout } = useAuth();
  const [siteContent, setSiteContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-pill whitespace-nowrap ${isActive ? "nav-pill-active" : ""}`;

  useEffect(() => {
    const controller = new AbortController();
    api.get<SiteContent>("/site-content", { signal: controller.signal })
      .then(({ data }) => setSiteContent(data))
      .catch((error) => {
        if (!controller.signal.aborted) console.error("Could not load saved website branding.", error);
      });
    return () => controller.abort();
  }, []);

  const tournamentLinks = tournamentId ? [
    { to: `${tournamentId}/registration`, label: "Registration", staffOnly: true },
    { to: `${tournamentId}/courts`, label: "Manage games & courts", staffOnly: true },
    { to: `${tournamentId}/location`, label: "Location", staffOnly: true },
    { to: `${tournamentId}/kiosk`, label: "Live board", staffOnly: false },
    { to: `${tournamentId}/leaderboard`, label: "Standings", staffOnly: false },
    { to: `${tournamentId}/bracket`, label: "Bracket", staffOnly: false },
    { to: `${tournamentId}/raffle`, label: "Raffle", staffOnly: false },
    { to: `${tournamentId}/changes`, label: "Activity", staffOnly: false, signedInOnly: true },
  ].filter((item) => (!item.staffOnly || isClubOperator(user?.role)) && (!item.signedInOnly || !!user)) : [];

  return (
    <header className="site-header sticky top-0 z-40 border-b border-white/10 bg-[#070936]/95 backdrop-blur-xl">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-[4.25rem] items-center justify-between gap-3 py-2">
          <Link to="/" aria-label={`Go to ${siteContent.branding.name || clubLorenzo.name} home`} className="flex min-w-0 shrink-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ball/25 bg-ball/10">
              <img src={fileUrl(siteContent.branding.markUrl)} alt="" className="h-7 w-7 brightness-0 invert" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-bold leading-tight tracking-wide text-white">{siteContent.branding.name || clubLorenzo.name}</span>
              <span className="hidden truncate text-[9px] uppercase tracking-[0.16em] text-white/45 sm:block">{siteContent.branding.tagline}</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <Link to={`/community/profile/${encodeURIComponent(user.username)}`} className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white">
                  <img src={fileUrl(user.avatarUrl)} alt="" className="h-7 w-7 rounded-full border border-white/15 object-cover" />
                  <span className="hidden max-w-32 truncate font-semibold sm:inline">{user.username}</span>
                </Link>
                <button type="button" onClick={() => void logout()} className="secondary-button min-h-10 px-3 text-xs sm:text-sm">Sign out</button>
              </>
            ) : (
              <>
                <Link to="/community/login" className="secondary-button min-h-10 px-3 text-xs sm:text-sm">Sign in</Link>
                <Link to="/community/register" className="action-button min-h-10 px-3 text-xs sm:text-sm">Join</Link>
              </>
            )}
          </div>
        </div>

        <nav className="app-navigation flex min-w-0 items-center gap-1 overflow-x-auto border-t border-white/[0.07] py-2" aria-label="Main navigation">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/community" end className={linkClass}>Events</NavLink>
          <NavLink to="/community/leaderboard" className={linkClass}>Rankings</NavLink>
          <NavLink to="/tournaments" className={linkClass}>Open play</NavLink>
          {user && ["ADMIN", "SUPERADMIN", "STAFF"].includes(user.role) && <NavLink to="/community/new" className={linkClass}>Post an event</NavLink>}
          {user && <NavLink to="/community/members" className={linkClass}>Members</NavLink>}
          {user && (
            <NavLink
              to="/community/notifications"
              className={linkClass}
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            >
              Notifications
              {unreadCount > 0 && <span className="ml-2 rounded-full bg-ball px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}
            </NavLink>
          )}
          {tournamentLinks.map((item) => <NavLink key={item.to} to={item.to} className={linkClass}>{item.label}</NavLink>)}
          {isClubOperator(user?.role) && <NavLink to="/manage" className={linkClass}>Manage club</NavLink>}
          {isSiteAdmin(user?.role) && <NavLink to="/manage-accounts" className={linkClass}>Accounts</NavLink>}
          {isSiteAdmin(user?.role) && <NavLink to="/manage-site" className={linkClass}>Edit website</NavLink>}
        </nav>
      </div>
    </header>
  );
}
