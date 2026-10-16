import { clubLorenzo } from "../lib/clubLorenzo";

export default function Footer({ variant = "dark", name = clubLorenzo.name, tagline = "Club pickleball & community events" }: { variant?: "dark" | "light"; name?: string; tagline?: string }) {
  const appearance = variant === "light"
    ? "border-[#080886]/10 text-[#555b83]"
    : "border-white/10 text-white/40";

  return (
    <footer className={`border-t px-4 py-5 text-center ${appearance}`}>
      <p className="text-[10px] uppercase tracking-[0.2em]">{name} · {tagline}</p>
      <p className="mt-2 text-[10px] tracking-[0.08em]">Developed by Engr. R.J. Oculam</p>
    </footer>
  );
}