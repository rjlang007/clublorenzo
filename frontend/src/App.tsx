import { Component, lazy, Suspense, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { Routes, Route, Link, useParams, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { api, Tournament } from "./lib/api";
import { useTournamentSocket } from "./lib/socket";
import Footer from "./components/Footer";
import AppHeader from "./components/AppHeader";

const TournamentSetup = lazy(() => import("./pages/TournamentSetup"));
const Registration = lazy(() => import("./pages/Registration"));
const CourtControl = lazy(() => import("./pages/CourtControl"));
const Kiosk = lazy(() => import("./pages/Kiosk"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const BracketView = lazy(() => import("./pages/BracketView"));
const TournamentChanges = lazy(() => import("./pages/TournamentChanges"));
const TournamentLogin = lazy(() => import("./pages/TournamentLogin"));
const TournamentHome = lazy(() => import("./pages/TournamentHome"));
const HappeningNow = lazy(() => import("./pages/HappeningNow"));
const TournamentLocation = lazy(() => import("./pages/TournamentLocation"));
const TournamentHeader = lazy(() => import("./components/TournamentHeader"));
const Register = lazy(() => import("./pages/community/Register"));
const Raffle = lazy(() => import("./pages/Raffle"));
const CelebrationOverlay = lazy(() => import("./components/CelebrationOverlay"));
const CommunityShell = lazy(() => import("./pages/community/CommunityShell"));
const Feed = lazy(() => import("./pages/community/Feed"));
const CreatePost = lazy(() => import("./pages/community/CreatePost"));
const PostDetail = lazy(() => import("./pages/community/PostDetail"));
const Profile = lazy(() => import("./pages/community/Profile"));
const Members = lazy(() => import("./pages/community/Members"));
const CommunityLeaderboard = lazy(() => import("./pages/community/CommunityLeaderboard"));
const Notifications = lazy(() => import("./pages/community/Notifications"));
const CommunityLogin = lazy(() => import("./pages/community/Login"));
const Privacy = lazy(() => import("./pages/Legal").then(({ Privacy }) => ({ default: Privacy })));
const Terms = lazy(() => import("./pages/Legal").then(({ Terms }) => ({ default: Terms })));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));
const SiteContentEditor = lazy(() => import("./pages/SiteContentEditor"));

function isClubOperator(role: string | undefined): boolean {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "STAFF";
}

function RouteLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f3f5ff] p-6 text-center text-[#080886]" role="status" aria-live="polite">
      <p className="font-display text-2xl uppercase">Loading Club Lorenzo…</p>
    </div>
  );
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("A Club Lorenzo page could not be displayed.", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#f3f5ff] px-5 py-12 text-center text-[#11134f]" role="alert">
          <div className="max-w-lg">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#4147a7]">Page unavailable</p>
            <h1 className="mt-3 font-display text-4xl uppercase sm:text-5xl">Let’s get you back on court.</h1>
            <p className="mt-4 text-sm leading-6 text-[#555b83]">This page could not be loaded. Reload the site to try again.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-7 inline-flex min-h-12 items-center justify-center rounded-md bg-[#080886] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1616ad]">Reload Club Lorenzo</button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f5ff] px-5 py-12 text-center text-[#11134f]">
      <div className="max-w-lg">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#4147a7]">404 · Out of bounds</p>
        <h1 className="mt-3 font-display text-5xl uppercase sm:text-6xl">This page missed the court.</h1>
        <p className="mt-4 text-sm leading-6 text-[#555b83]">That page may have moved. Head back to the club or find an upcoming game.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#080886] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1616ad]">Club home</Link>
          <Link to="/tournaments" className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#080886]/20 px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#080886] transition hover:bg-white">Find a game</Link>
        </div>
      </div>
    </main>
  );
}

function StandaloneShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div id="main-content" key={location.pathname} className="page-enter">{children}</div>
    </div>
  );
}

function Shell() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const returnToDashboard = useCallback(() => {
    if (user?.role === "PLAYER") void logout();
    navigate("/", { replace: true });
  }, [logout, navigate, user?.role]);
  const loadTournament = useCallback(() => {
    if (!tournamentId) return;
    api.get<Tournament>(`/tournaments/${tournamentId}`).then(({ data }) => setTournament(data)).catch((error) => {
      if (error?.response?.status === 404) returnToDashboard();
      else console.error("Could not load tournament details.", error);
    });
  }, [returnToDashboard, tournamentId]);

  useTournamentSocket(tournamentId, ["tournament:deleted"], returnToDashboard);
  useTournamentSocket(tournamentId, ["tournament:changed"], loadTournament);
  useEffect(() => { loadTournament(); }, [loadTournament]);

  if (loading) return <RouteLoading />;
  if (!tournamentId) return <Navigate to="/" replace />;
  const base = `/t/${tournamentId}`;
  return (
    <div className="app-shell">
      <TournamentHeader
        tournamentId={tournamentId}
        tournamentName={tournament?.name ?? "Tournament"}
        tournamentType={tournament?.type}
        postId={tournament?.postId}
        userRole={user?.role}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <main id="main-content" key={location.pathname} className="page-enter pb-10 pt-6">
          <CelebrationOverlay tournamentId={tournamentId} />
          <Routes>
            <Route index element={tournament ? <TournamentHome tournament={tournament} /> : <RouteLoading />} />
            <Route path="registration" element={<Registration />} />
            <Route path="courts" element={isClubOperator(user?.role) ? <CourtControl /> : <Navigate to="/login" state={{ from: `${base}/courts` }} replace />} />
            <Route path="location" element={isClubOperator(user?.role) ? <TournamentLocation /> : <Navigate to="/login" state={{ from: `${base}/location` }} replace />} />
            <Route path="kiosk" element={<Kiosk />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="bracket" element={<BracketView />} />
            <Route path="changes" element={user ? <TournamentChanges /> : <Navigate to="/login" state={{ from: `${base}/changes` }} replace />} />
            <Route path="raffle" element={<Raffle />} />
          </Routes>
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <RouteLoading />;

  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/login" element={<TournamentLogin />} />
          <Route path="/community/register" element={<Register />} />
          <Route path="/community/login" element={<CommunityLogin />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/happening-now" element={<HappeningNow />} />
          <Route path="/tournaments" element={<StandaloneShell><TournamentSetup publicOnly /></StandaloneShell>} />
          <Route path="/manage" element={isClubOperator(user?.role) ? <StandaloneShell><TournamentSetup /></StandaloneShell> : <Navigate to="/login" state={{ from: "/manage" }} replace />} />
          <Route path="/manage-accounts" element={user && (user.role === "ADMIN" || user.role === "SUPERADMIN") ? <StandaloneShell><RoleManagement /></StandaloneShell> : <Navigate to="/login" state={{ from: "/manage-accounts" }} replace />} />
          <Route path="/manage-site" element={user && (user.role === "ADMIN" || user.role === "SUPERADMIN") ? <StandaloneShell><SiteContentEditor /></StandaloneShell> : <Navigate to="/login" state={{ from: "/manage-site" }} replace />} />
          <Route path="/community" element={<CommunityShell />}>
            <Route index element={<Feed />} />
            <Route path="new" element={<CreatePost />} />
            <Route path="leaderboard" element={<CommunityLeaderboard />} />
            <Route path=":postId/edit" element={<CreatePost />} />
            <Route path=":postId" element={<PostDetail />} />
            <Route path="profile/:username" element={user ? <Profile /> : <Navigate to="/community/login" state={{ from: location.pathname }} replace />} />
            <Route path="members" element={<Members />} />
            <Route path="notifications" element={user ? <Notifications /> : <Navigate to="/community/login" replace />} />
          </Route>
          <Route path="/t/:tournamentId/*" element={<Shell />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}
