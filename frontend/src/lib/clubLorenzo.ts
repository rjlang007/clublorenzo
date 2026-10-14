const env = import.meta.env;
const normalizePublicUrl = (value: string | undefined) => {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

export const clubLorenzo = {
  name: "Club Lorenzo",
  shortName: "Club Lorenzo",
  tagline: "Alumni roots. A growing community.",
  description:
    "Founded by San Lorenzo Ruiz School alumni, Club Lorenzo has grown into a welcoming community where more players and friends come together through pickleball.",
  location: env.VITE_CLUB_LOCATION?.trim() || "See upcoming events for court locations",
  locationUrl: normalizePublicUrl(env.VITE_CLUB_MAP_URL),
  email: env.VITE_CLUB_EMAIL?.trim() || "",
  phone: env.VITE_CLUB_PHONE?.trim() || "",
  socialLinks: {
    instagram: normalizePublicUrl(env.VITE_CLUB_INSTAGRAM_URL),
    facebook: normalizePublicUrl(env.VITE_CLUB_FACEBOOK_URL),
    x: normalizePublicUrl(env.VITE_CLUB_X_URL),
  },
  policies: {
    terms: "/terms",
    privacy: "/privacy",
  },
} as const;
