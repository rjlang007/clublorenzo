import { Router, type NextFunction, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { attachUser, AuthedRequest, requireAuth } from "../lib/auth";
import { uploadSiteImage } from "../lib/uploads";

export const siteContentRouter = Router();

const imageUrlSchema = z.string().max(500).refine(
  (value) => !value || value.startsWith("/brand/") || value.startsWith("/uploads/site/") || /^https:\/\//i.test(value),
  "Images must use a Club Lorenzo brand image, uploaded site image, or HTTPS URL.",
);
const imageSchema = z.object({
  imageUrl: imageUrlSchema,
  alt: z.string().max(300),
  label: z.string().max(120),
});

const contentSchema = z.object({
  branding: z.object({
    name: z.string().min(1).max(80),
    tagline: z.string().max(160),
    logoUrl: imageUrlSchema,
    markUrl: imageUrlSchema,
  }),
  hero: z.object({
    eyebrow: z.string().max(120),
    titleFirst: z.string().min(1).max(80),
    titleSecond: z.string().min(1).max(80),
    description: z.string().max(1000),
    imageUrl: imageUrlSchema,
    imageAlt: z.string().max(300),
    locationNote: z.string().max(200),
    primaryButton: z.string().max(80),
    secondaryButton: z.string().max(80),
  }),
  events: z.object({
    eyebrow: z.string().max(120),
    title: z.string().max(120),
    button: z.string().max(80),
    listingTitle: z.string().max(120),
    listingButton: z.string().max(100),
  }),
  story: z.object({
    eyebrow: z.string().max(120),
    title: z.string().max(200),
    paragraphOne: z.string().max(1500),
    paragraphTwo: z.string().max(1500),
    actionOne: z.string().max(100),
    actionTwo: z.string().max(100),
    patronEyebrow: z.string().max(120),
    patronName: z.string().max(100),
    patronImageUrl: imageUrlSchema,
    patronImageAlt: z.string().max(300),
  }),
  archive: z.object({
    eyebrow: z.string().max(120),
    title: z.string().max(120),
    description: z.string().max(1000),
    action: z.string().max(100),
    posters: z.array(imageSchema).length(2),
  }),
  people: z.object({
    eyebrow: z.string().max(120),
    title: z.string().max(120),
    description: z.string().max(500),
    cards: z.array(imageSchema).length(3),
  }),
  merch: z.object({
    eyebrow: z.string().max(120),
    title: z.string().max(120),
    description: z.string().max(500),
    imageUrl: imageUrlSchema,
    imageAlt: z.string().max(300),
    caption: z.string().max(300),
    label: z.string().max(100),
    titleFirst: z.string().max(80),
    titleSecond: z.string().max(80),
    body: z.string().max(500),
    button: z.string().max(100),
  }),
  callToAction: z.object({
    eyebrow: z.string().max(120),
    title: z.string().max(200),
    button: z.string().max(100),
  }),
  contact: z.object({
    location: z.string().max(200),
    email: z.string().max(254).email().or(z.literal("")),
    phone: z.string().max(40),
    mapUrl: z.string().max(500).refine((value) => !value || /^https:\/\//i.test(value), "Links must use HTTPS."),
    instagram: z.string().max(500).refine((value) => !value || /^https:\/\//i.test(value), "Links must use HTTPS."),
    facebook: z.string().max(500).refine((value) => !value || /^https:\/\//i.test(value), "Links must use HTTPS."),
    x: z.string().max(500).refine((value) => !value || /^https:\/\//i.test(value), "Links must use HTTPS."),
  }),
});

export type SiteContent = z.infer<typeof contentSchema>;

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
  events: {
    eyebrow: "Make a date with the court",
    title: "What’s coming up",
    button: "All club events",
    listingTitle: "Events & Open Play",
    listingButton: "Browse all events",
  },
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
  contact: {
    location: "",
    email: "",
    phone: "",
    mapUrl: "",
    instagram: "",
    facebook: "",
    x: "",
  },
};

function requireSiteAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Not signed in." });
  prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
    .then((user) => {
      if (!user || !["SUPERADMIN", "ADMIN"].includes(user.role)) {
        return res.status(403).json({ error: "Superadmin or club admin access is required to edit website content." });
      }
      next();
    })
    .catch(next);
}

siteContentRouter.get("/", async (_req, res) => {
  const stored = await prisma.siteContent.findUnique({ where: { id: "homepage" } });
  const parsed = contentSchema.safeParse(stored?.content ?? DEFAULT_SITE_CONTENT);
  if (!parsed.success) {
    console.error("Stored public site content is invalid.", parsed.error.flatten());
    return res.status(500).json({ error: "Website content is invalid. Ask an administrator to review it." });
  }
  res.json(parsed.data);
});

siteContentRouter.get("/admin", attachUser, requireAuth, requireSiteAdmin, async (_req, res) => {
  const [stored, revisions] = await Promise.all([
    prisma.siteContent.findUnique({ where: { id: "homepage" } }),
    prisma.siteContentRevision.findMany({
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: { id: true, publishedAt: true, actorName: true },
    }),
  ]);
  const published = contentSchema.safeParse(stored?.content ?? DEFAULT_SITE_CONTENT);
  const draft = contentSchema.safeParse(stored?.draft ?? stored?.content ?? DEFAULT_SITE_CONTENT);
  if (!published.success || !draft.success) {
    console.error("Stored site content or draft is invalid.", {
      published: published.success ? undefined : published.error.flatten(),
      draft: draft.success ? undefined : draft.error.flatten(),
    });
    return res.status(500).json({ error: "Website content is invalid. Ask an administrator to review it." });
  }
  res.json({
    published: published.data,
    draft: draft.data,
    updatedAt: stored?.updatedAt ?? null,
    revisions,
  });
});

siteContentRouter.put("/draft", attachUser, requireAuth, requireSiteAdmin, async (req, res) => {
  const parsed = contentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const saved = await prisma.siteContent.upsert({
    where: { id: "homepage" },
    create: { id: "homepage", content: DEFAULT_SITE_CONTENT, draft: parsed.data },
    update: { draft: parsed.data },
  });
  res.json({ draft: parsed.data, updatedAt: saved.updatedAt });
});

siteContentRouter.post("/publish", attachUser, requireAuth, requireSiteAdmin, async (req: AuthedRequest, res) => {
  const stored = await prisma.siteContent.findUnique({ where: { id: "homepage" } });
  if (!stored?.draft) return res.status(409).json({ error: "Save a draft before publishing." });

  const draft = contentSchema.safeParse(stored.draft);
  const previous = contentSchema.safeParse(stored?.content ?? DEFAULT_SITE_CONTENT);
  if (!draft.success || !previous.success) {
    return res.status(500).json({ error: "Website content is invalid. Save a valid draft before publishing." });
  }
  const actorId = req.userId;
  if (!actorId) return res.status(401).json({ error: "Not signed in." });
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true } });
  if (!actor) return res.status(401).json({ error: "Account not found." });

  const publishedAt = new Date();
  const revision = await prisma.$transaction(async (transaction) => {
    const savedRevision = await transaction.siteContentRevision.create({
      data: {
        content: previous.data,
        publishedAt,
        actorId,
        actorName: actor.username,
      },
    });
    await transaction.siteContent.update({
      where: { id: "homepage" },
      data: { content: draft.data },
    });
    const excessRevisions = await transaction.siteContentRevision.findMany({
      orderBy: { publishedAt: "desc" },
      skip: 20,
      select: { id: true },
    });
    if (excessRevisions.length) {
      await transaction.siteContentRevision.deleteMany({
        where: { id: { in: excessRevisions.map((revision) => revision.id) } },
      });
    }
    return savedRevision;
  });
  res.json({
    content: draft.data,
    revision: { id: revision.id, publishedAt: revision.publishedAt, actorName: revision.actorName },
  });
});

siteContentRouter.post("/revisions/:revisionId/restore", attachUser, requireAuth, requireSiteAdmin, async (req, res) => {
  const revision = await prisma.siteContentRevision.findUnique({ where: { id: req.params.revisionId } });
  if (!revision) return res.status(404).json({ error: "That website revision could not be found." });
  const parsed = contentSchema.safeParse(revision.content);
  if (!parsed.success) {
    console.error("Stored site content revision is invalid.", parsed.error.flatten());
    return res.status(500).json({ error: "That website revision is invalid and cannot be restored." });
  }
  const saved = await prisma.siteContent.upsert({
    where: { id: "homepage" },
    create: { id: "homepage", content: DEFAULT_SITE_CONTENT, draft: parsed.data },
    update: { draft: parsed.data },
  });
  res.json({ draft: parsed.data, updatedAt: saved.updatedAt });
});

siteContentRouter.post("/image", attachUser, requireAuth, requireSiteAdmin, (req, res, next) => {
  uploadSiteImage.single("image")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError || error.message.startsWith("Only JPEG")) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an image to upload." });
  res.status(201).json({ imageUrl: `/uploads/site/${req.file.filename}` });
});
