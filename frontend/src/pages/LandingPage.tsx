import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Footer from "../components/Footer";
import LeaderboardSpotlight from "../components/LeaderboardSpotlight";
import PublicEventListings from "../components/PublicEventListings";
import { useAuth } from "../context/AuthContext";
import { api, fileUrl } from "../lib/api";
import { clubLorenzo } from "../lib/clubLorenzo";
import { DEFAULT_SITE_CONTENT, safePublicUrl, type SiteContent } from "../lib/siteContent";

export default function LandingPage() {
  const { user } = useAuth();
  const location = useLocation();
  const previewContent = (location.state as { siteContentPreview?: SiteContent } | null)?.siteContentPreview;
  const [menuOpen, setMenuOpen] = useState(false);
  const [siteContent, setSiteContent] = useState<SiteContent>(previewContent ?? DEFAULT_SITE_CONTENT);
  const [showIntro, setShowIntro] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const staff = user?.role === "ADMIN" || user?.role === "SUPERADMIN" || user?.role === "STAFF";
  const canEditSite = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (previewContent) {
      setSiteContent(previewContent);
      return;
    }
    const controller = new AbortController();
    api.get<SiteContent>("/site-content", { signal: controller.signal })
      .then(({ data }) => setSiteContent(data))
      .catch((error) => {
        if (!controller.signal.aborted) console.error("Could not load saved website content.", error);
      });
    return () => controller.abort();
  }, [previewContent]);

  useEffect(() => {
    if (!showIntro) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timeout = window.setTimeout(() => setShowIntro(false), 2600);

    return () => {
      window.clearTimeout(timeout);
      document.body.style.overflow = previousOverflow;
    };
  }, [showIntro]);

  return (
    <div className="landing-page-enter min-h-screen overflow-hidden bg-white text-[#11134f]">
      {previewContent && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-center gap-2 bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-[#2b2100]">
          <span>Previewing an unpublished draft. Visitors still see the published website.</span>
          <Link to="/manage-site" state={{ siteContentDraft: previewContent }} className="underline underline-offset-2">Return to editor</Link>
        </div>
      )}
      {showIntro && (
        <div className="landing-intro" role="status" aria-label={`Welcome to ${siteContent.branding.name}`}>
          <div className="landing-intro-brand">
            <img src={fileUrl(siteContent.branding.markUrl)} alt="" className="landing-intro-mark" />
            <p className="landing-intro-name">{siteContent.branding.name}</p>
            <span className="landing-intro-rule" aria-hidden="true" />
            <p className="landing-intro-tagline">{siteContent.branding.tagline}</p>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-[#080886]/10 bg-white/95 backdrop-blur">
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8" aria-label="Main navigation">
          <Link
            to="/"
            aria-label={`Go to ${siteContent.branding.name} home`}
            className="group flex min-w-0 items-center rounded-sm transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
            onClick={() => {
              closeMenu();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <img src={fileUrl(siteContent.branding.logoUrl)} alt={`${siteContent.branding.name} pickleball club`} className="h-10 w-auto max-w-[min(62vw,230px)] object-contain sm:h-12 sm:max-w-[250px]" />
          </Link>

          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#080886]/20 text-xl text-[#080886] lg:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "×" : "☰"}
          </button>

          <div id="primary-navigation" className={`${menuOpen ? "absolute inset-x-0 top-full flex border-b border-[#080886]/10 bg-white p-4 shadow-lg sm:p-5" : "hidden"} flex-col gap-2 lg:static lg:flex lg:flex-row lg:items-center lg:gap-5 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}>
            <a href="#about" onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-[#555b83] hover:bg-[#f3f5ff] hover:text-[#080886] lg:px-0 lg:hover:bg-transparent">Our story</a>
            <a href="#players" onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-[#555b83] hover:bg-[#f3f5ff] hover:text-[#080886] lg:px-0 lg:hover:bg-transparent">Our people</a>
            <a href="#merch" onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-[#555b83] hover:bg-[#f3f5ff] hover:text-[#080886] lg:px-0 lg:hover:bg-transparent">Club gear</a>
            <Link to="/community" onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-[#555b83] hover:bg-[#f3f5ff] hover:text-[#080886] lg:px-0 lg:hover:bg-transparent">Events</Link>
            <Link to="/community/leaderboard" onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-[#555b83] hover:bg-[#f3f5ff] hover:text-[#080886] lg:px-0 lg:hover:bg-transparent">Rankings</Link>
            <Link to="/happening-now" onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-[#080886] hover:bg-[#f3f5ff] lg:px-0 lg:hover:bg-transparent">Happening now</Link>
            {canEditSite && <Link to="/manage-site" onClick={closeMenu} className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-[#555b83] hover:bg-[#f3f5ff] hover:text-[#080886] lg:px-0 lg:hover:bg-transparent">Edit website</Link>}
            <Link to={staff ? "/manage" : "/tournaments"} onClick={closeMenu} className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md bg-[#080886] px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1616ad] lg:mt-0">
              {staff ? "Manage club" : "Come play"}
            </Link>
          </div>
        </nav>
      </header>

      <main id="home">
        <section className="bg-[#f3f5ff] px-3 py-5 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="mx-auto max-w-7xl">
            <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-[#080886] sm:mb-5 sm:text-xs">{siteContent.hero.eyebrow}</p>
            <div className="grid min-w-0 overflow-hidden rounded-2xl bg-[#080886] shadow-[0_24px_70px_rgba(8,8,134,0.18)] lg:grid-cols-[1.1fr_0.9fr]">
              <img
                src={fileUrl(siteContent.hero.imageUrl)}
                alt={siteContent.hero.imageAlt}
                className="landing-hero-media aspect-[4/3] w-full bg-white object-cover sm:aspect-[16/9] lg:aspect-auto lg:min-h-[500px]"
                loading="eager"
              />
              <div className="landing-hero-copy flex min-w-0 flex-col justify-center px-5 py-7 text-white sm:px-8 sm:py-10 lg:px-12 lg:py-12">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#bdcaff]">{siteContent.branding.name} · PLAY TOGETHER</p>
                <h1 className="mt-4 font-display text-[clamp(2.45rem,8.5vw,5rem)] uppercase leading-[0.94] tracking-wide">{siteContent.hero.titleFirst}<br /><span className="text-[#aebfff]">{siteContent.hero.titleSecond}</span></h1>
                <p className="mt-5 max-w-md text-sm leading-6 text-white/80 sm:text-base">{siteContent.hero.description}</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link to="/tournaments" className="inline-flex min-h-12 items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#080886] transition hover:bg-[#e5eaff]">
                    {siteContent.hero.primaryButton} <span className="ml-2" aria-hidden="true">↗</span>
                  </Link>
                  <Link to="/happening-now" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#f2c94c] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#11134f] transition hover:bg-[#ffe27d]">
                    Happening now <span className="ml-2" aria-hidden="true">↗</span>
                  </Link>
                  <a href="#about" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/45 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white/10">{siteContent.hero.secondaryButton}</a>
                </div>
                <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">{siteContent.hero.locationNote || siteContent.contact.location || clubLorenzo.location}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="events" className="scroll-mt-4 bg-[#080886] py-14 text-white sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#bdcaff]">{siteContent.events.eyebrow}</p>
                <h2 className="mt-2 font-display text-4xl uppercase text-white sm:text-5xl">{siteContent.events.title}</h2>
              </div>
              <Link to="/community" className="rounded-md border border-white/45 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10">{siteContent.events.button} <span aria-hidden="true">↗</span></Link>
            </div>
            <PublicEventListings eyebrow={siteContent.branding.name} heading={siteContent.events.listingTitle} browseLabel={siteContent.events.listingButton} />
          </div>
        </section>

        <LeaderboardSpotlight />

        <section id="about" className="scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#4147a7]">{siteContent.story.eyebrow}</p>
              <h2 className="mt-3 max-w-xl font-display text-[clamp(2.5rem,6vw,4rem)] uppercase leading-[0.98]">{siteContent.story.title}</h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#555b83]">
                {siteContent.story.paragraphOne}
              </p>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#555b83]">
                {siteContent.story.paragraphTwo}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/community" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#080886] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1616ad]">{siteContent.story.actionOne} <span className="ml-2" aria-hidden="true">↗</span></Link>
                <a href="#our-patron" className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#080886]/20 px-5 py-3 text-sm font-semibold text-[#080886] transition hover:bg-[#f3f5ff]">{siteContent.story.actionTwo}</a>
              </div>
            </div>
            <figure id="our-patron" className="mx-auto w-full max-w-md scroll-mt-24 overflow-hidden rounded-2xl bg-[#080886] p-3 shadow-[0_20px_55px_rgba(8,8,134,0.18)]">
              <img
                src={fileUrl(siteContent.story.patronImageUrl)}
                alt={siteContent.story.patronImageAlt}
                className="max-h-[27rem] w-full rounded-xl bg-white object-contain"
                loading="lazy"
              />
              <figcaption className="px-3 pb-2 pt-4 text-white">
                <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-[#cbd4ff]">{siteContent.story.patronEyebrow}</span>
                <span className="mt-1 block font-display text-2xl uppercase">{siteContent.story.patronName}</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="bg-[#f0f2ff] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24" aria-labelledby="story-heading">
          <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#4147a7]">{siteContent.archive.eyebrow}</p>
              <h2 id="story-heading" className="mt-3 font-display text-5xl uppercase leading-none sm:text-6xl">{siteContent.archive.title}</h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-[#555b83]">{siteContent.archive.description}</p>
              <Link to="/tournaments" className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#080886] px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1616ad]">{siteContent.archive.action} <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {siteContent.archive.posters.map((poster, index) => (
                <figure key={`${poster.imageUrl}-${index}`} className="overflow-hidden rounded-lg border border-[#080886]/15 bg-white p-2 shadow-[0_14px_38px_rgba(8,8,134,0.12)]">
                  <img src={fileUrl(poster.imageUrl)} alt={poster.alt} className="aspect-[3/4] w-full object-contain" loading="lazy" />
                  <figcaption className="px-3 py-3 font-display text-xl uppercase tracking-wide text-[#080886]">{poster.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="players" className="scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#4147a7]">{siteContent.people.eyebrow}</p>
                  <h2 className="mt-2 font-display text-4xl uppercase sm:text-5xl">{siteContent.people.title}</h2>
              </div>
                <p className="max-w-sm text-sm leading-6 text-[#555b83]">{siteContent.people.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {siteContent.people.cards.map((player, index) => (
                  <figure key={`${player.imageUrl}-${index}`} className="relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#080886]/10 bg-white">
                    <img src={fileUrl(player.imageUrl)} alt={player.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                    <figcaption className="flex-1 bg-[#080886] px-4 py-4 font-display text-lg uppercase tracking-wide text-white sm:px-5 sm:text-xl">{player.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="merch" className="scroll-mt-20 bg-[#080886] px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#bdcaff]">{siteContent.merch.eyebrow}</p>
                  <h2 className="mt-2 font-display text-4xl uppercase sm:text-5xl">{siteContent.merch.title}</h2>
              </div>
                <p className="max-w-sm text-sm leading-6 text-white/75">{siteContent.merch.description}</p>
            </div>
            <div className="grid min-w-0 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <figure className="overflow-hidden rounded-lg bg-white p-2">
                  <img src={fileUrl(siteContent.merch.imageUrl)} alt={siteContent.merch.imageAlt} className="w-full" loading="lazy" />
                  <figcaption className="px-3 py-3 text-xs text-[#555b83]">{siteContent.merch.caption}</figcaption>
              </figure>
              <div className="border-l-2 border-[#b9c8ff] pl-4 sm:pl-6 lg:pl-8">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#bdcaff]">{siteContent.merch.label}</p>
                  <h3 className="mt-3 font-display text-4xl uppercase leading-none sm:text-5xl">{siteContent.merch.titleFirst}<br />{siteContent.merch.titleSecond}</h3>
                  <p className="mt-4 text-sm leading-6 text-white/75">{siteContent.merch.body}</p>
                  <Link to="/community" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md border border-white/60 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white hover:text-[#080886]">{siteContent.merch.button} <span className="ml-2" aria-hidden="true">↗</span></Link>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-lg bg-[#eef0ff] p-5 sm:p-8 lg:gap-7 lg:p-12 xl:flex-row xl:items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#4147a7]">{siteContent.callToAction.eyebrow}</p>
              <h2 className="mt-2 max-w-2xl font-display text-4xl uppercase leading-tight sm:text-5xl">{siteContent.callToAction.title}</h2>
            </div>
            <Link to="/tournaments" className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#080886] px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#1616ad] sm:w-auto sm:px-7">{siteContent.callToAction.button} <span className="ml-2 shrink-0" aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <section className="border-t border-[#080886]/10 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 sm:flex-row sm:items-center">
            <div>
              <img src={fileUrl(siteContent.branding.logoUrl)} alt={siteContent.branding.name} className="h-14 w-auto max-w-[min(70vw,250px)] object-contain" loading="lazy" />
              <p className="mt-1 text-sm text-[#555b83]">{siteContent.contact.location || clubLorenzo.location}</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-3 text-sm font-semibold text-[#555b83] sm:gap-x-5">
              {([
                ["instagram", safePublicUrl(siteContent.contact.instagram) || clubLorenzo.socialLinks.instagram],
                ["facebook", safePublicUrl(siteContent.contact.facebook) || clubLorenzo.socialLinks.facebook],
                ["x", safePublicUrl(siteContent.contact.x) || clubLorenzo.socialLinks.x],
              ] as const).filter(([, url]) => url).map(([network, url]) => (
                <a key={network} href={url} target="_blank" rel="noopener noreferrer" className="capitalize hover:text-[#080886]">{network} ↗</a>
              ))}
              {siteContent.contact.email && <a href={`mailto:${siteContent.contact.email}`} className="hover:text-[#080886]">Email us</a>}
              {siteContent.contact.phone && <a href={`tel:${siteContent.contact.phone.replace(/[^\d+]/g, "")}`} className="hover:text-[#080886]">{siteContent.contact.phone}</a>}
              {(safePublicUrl(siteContent.contact.mapUrl) || clubLorenzo.locationUrl) && <a href={safePublicUrl(siteContent.contact.mapUrl) || clubLorenzo.locationUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#080886]">Find us ↗</a>}
              <Link to="/community" className="hover:text-[#080886]">Events</Link>
              {!user && <Link to="/login" className="hover:text-[#080886]">Staff sign in</Link>}
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" name={siteContent.branding.name} tagline={siteContent.branding.tagline} />
    </div>
  );
}
