import { useState, FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { clubLorenzo } from "../../lib/clubLorenzo";

export default function Register() {
  const { user, register, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { from?: string } | null;
  const requestedDestination = routeState?.from;
  const destination = requestedDestination?.startsWith("/community/") || requestedDestination?.startsWith("/t/") || requestedDestination === "/tournaments"
    ? requestedDestination
    : "/community";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={destination} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (password !== confirm) {
      setLocalError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const ok = await register(username.trim(), password);
    setSubmitting(false);
    if (ok) navigate(destination);
  }

  return (
    <div className="max-w-sm mx-auto mt-16 px-4">
      <Link to="/" aria-label="Back to Club Lorenzo home" className="mb-7 inline-block"><img src="/brand/club-lorenzo-logo.png" alt={clubLorenzo.name} className="h-12 w-auto brightness-0 invert" /></Link>
      <h1 className="font-display text-2xl font-bold text-white mb-2">Create your account</h1>
      <p className="text-sm text-white/60 mb-6">
        Create a Club Lorenzo player account to register for events and follow your games.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-white/70 mb-1">Username</label>
          <input
            className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white outline-none focus:border-ball"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="3-20 characters, letters/numbers/underscore"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-sm text-white/70 mb-1">Password</label>
          <input
            type="password"
            className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white outline-none focus:border-ball"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-white/70 mb-1">Confirm password</label>
          <input
            type="password"
            className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white outline-none focus:border-ball"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {(localError || error) && <p className="text-sm text-advance">{localError || error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-ball text-neutral-900 font-display font-semibold py-2 disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-white/60 mt-4">
        Already have an account?{" "}
        <Link to="/community/login" state={{ from: destination }} className="text-ball hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
