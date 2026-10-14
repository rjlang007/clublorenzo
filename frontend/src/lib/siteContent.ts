export type SiteImage = {
  imageUrl: string;
  alt: string;
  label: string;
};

export type SiteContent = {
  branding: {
    name: string;
    tagline: string;
    logoUrl: string;
    markUrl: string;
  };
  hero: {
    eyebrow: string;
    titleFirst: string;
    titleSecond: string;
    description: string;
    imageUrl: string;
    imageAlt: string;
    locationNote: string;
    primaryButton: string;
    secondaryButton: string;
  };
  events: { eyebrow: string; title: string; button: string; listingTitle: string; listingButton: string };
  story: {
    eyebrow: string;
    title: string;
    paragraphOne: string;
    paragraphTwo: string;
    actionOne: string;
    actionTwo: string;
    patronEyebrow: string;
    patronName: string;
    patronImageUrl: string;
    patronImageAlt: string;
  };
  archive: {
    eyebrow: string;
    title: string;
    description: string;
    action: string;
    posters: SiteImage[];
  };
  people: {
    eyebrow: string;
    title: string;
    description: string;
    cards: SiteImage[];
  };
  merch: {
    eyebrow: string;
    title: string;
    description: string;
    imageUrl: string;
    imageAlt: string;
    caption: string;
    label: string;
    titleFirst: string;
    titleSecond: string;
    body: string;
    button: string;
  };
  callToAction: { eyebrow: string; title: string; button: string };
  contact: {
    location: string;
    email: string;
    phone: string;
    mapUrl: string;
    instagram: string;
    facebook: string;
    x: string;
  };
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  branding: {
    name: "Club Lorenzo",
    tagline: "Alumni roots. A growing community.",
    logoUrl: "/brand/club-lorenzo-logo.png",
    markUrl: "/brand/club-lorenzo-mark.png",
  },
  hero: {
    eyebrow: "ONE COMMUNITY, ENDLESS RALLIES",
    titleFirst: "One club.",
    titleSecond: "All heart.",
    description: "Founded by San Lorenzo Ruiz School alumni, Club Lorenzo has grown into a welcoming community where more players and friends come together through pickleball. Join us for open play, tournaments, and a community that keeps you coming back.",
    imageUrl: "/brand/club-lorenzo-community-partners.png",
    imageAlt: "Club Lorenzo members celebrating with their club banner and prizes at the courts",
    locationNote: "See upcoming events for court locations",
    primaryButton: "Find your next game",
    secondaryButton: "Get to know us",
  },
  events: { eyebrow: "Make a date with the court", title: "What’s coming up", button: "All club events", listingTitle: "Events & Open Play", listingButton: "Browse all events" },
  story: {
    eyebrow: "Where Club Lorenzo began",
    title: "Rooted in our school. United by pickleball.",
    paragraphOne: "Club Lorenzo was founded by alumni of San Lorenzo Ruiz School. What began as a way for schoolmates to reconnect over pickleball has grown into a vibrant club with more players joining through friends and invitations.",
    paragraphTwo: "Our roots remain in the school community, while our doors—and our courts—are open to the wider community. We welcome new faces to share the games, fellowship, and friendships that make Club Lorenzo special.",
    actionOne: "Explore club events",
    actionTwo: "Meet our namesake",
    patronEyebrow: "The school’s namesake",
    patronName: "Saint Lorenzo Ruiz",
    patronImageUrl: "/brand/san-lorenzo-ruiz.png",
    patronImageAlt: "Painting of Saint Lorenzo Ruiz, namesake of San Lorenzo Ruiz School",
  },
  archive: {
    eyebrow: "From the club archive",
    title: "Many games. One community.",
    description: "A look back at Club Lorenzo open plays and themed meetups. Follow the event board for the next chance to join us on court.",
    action: "Join the next game",
    posters: [
      { imageUrl: "/brand/club-lorenzo-seventh-open-play.png", alt: "Archive poster for Club Lorenzo's seventh open play on September 19, 2026", label: "OPEN PLAY" },
      { imageUrl: "/brand/club-lorenzo-themed-play-poster.png", alt: "Archive poster for Club Lorenzo's themed Slrap Yan open play", label: "THEMED OPEN PLAY" },
    ],
  },
  people: {
    eyebrow: "The people make the club",
    title: "Find your people.",
    description: "Friendly faces, new partners, familiar rivals. Your next favorite teammate could be waiting at the next open play.",
    cards: [
      { imageUrl: "/brand/club-lorenzo-community-partners.png", alt: "Club Lorenzo members celebrating with their club banner and prizes at the courts", label: "COMMUNITY, ON AND OFF COURT." },
      { imageUrl: "/brand/club-lorenzo-after-game.png", alt: "Two Club Lorenzo players smiling together after a game", label: "GOOD GAMES. GREAT COMPANY." },
      { imageUrl: "/brand/club-lorenzo-seventh-open-play.png", alt: "Club Lorenzo members celebrating their seventh open play together", label: "ONE COMMUNITY. ENDLESS RALLIES." },
    ],
  },
  merch: {
    eyebrow: "Wear it on and off court",
    title: "Wear the rally.",
    description: "Club Lorenzo dri-fit shirts bring a little team spirit to the courts. Ask the club about current merch and availability.",
    imageUrl: "/brand/club-lorenzo-shirts-promo.png",
    imageAlt: "Club Lorenzo dri-fit club shirt promotion featuring club members",
    caption: "Club gear featured in a past Club Lorenzo promotion.",
    label: "Club uniform",
    titleFirst: "Made for",
    titleSecond: "match day.",
    body: "Rep the club on court and bring the community spirit to every rally.",
    button: "See club updates",
  },
  callToAction: {
    eyebrow: "Your next game starts here",
    title: "Ready to meet us on court?",
    button: "View open play & tournaments",
  },
  contact: { location: "", email: "", phone: "", mapUrl: "", instagram: "", facebook: "", x: "" },
};

export function safePublicUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}
