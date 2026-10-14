import { clubLorenzo } from "../lib/clubLorenzo";

export default function Footer({ variant = "dark", name = clubLorenzo.name, tagline = "Club pickleball & community events" }: { variant?: "dark" | "light"; name?: string; tagline?: string }) {
  const appearance = variant === "light"
    ? "border-[#080886]/10 text-[#555b83]"
    : "border-white/10 text-white/40";

  return (
    <footer className={`border-t py-5 text-center text-[10px] uppercase tracking-[0.2em] ${appearance}`}>
      {name} · {tagline}
    </footer>
  );
}