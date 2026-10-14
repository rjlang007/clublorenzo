import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import { api, fileUrl } from "../lib/api";
import { DEFAULT_SITE_CONTENT, type SiteContent, type SiteImage } from "../lib/siteContent";
import PageHeader from "../components/PageHeader";

function TextField({ label, value, onChange, type = "text", maxLength = 500 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "url";
  maxLength?: number;
}) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-xs font-semibold text-white/70">{label}</span>
      <input className="field min-w-0" type={type} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3, maxLength = 1500 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-xs font-semibold text-white/70">{label}</span>
      <textarea className="field min-w-0 resize-y" rows={rows} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EditorSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="glass-panel min-w-0 space-y-5 p-4 sm:p-6" aria-label={title}>
      <div>
        <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-white/50">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ImageField({ label, imageUrl, onChange, onError }: {
  label: string;
  imageUrl: string;
  onChange: (imageUrl: string) => void;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const body = new FormData();
    body.append("image", file);
    setUploading(true);
    onError("");
    try {
      const { data } = await api.post<{ imageUrl: string }>("/site-content/image", body);
      onChange(data.imageUrl);
    } catch (error) {
      const message = error && typeof error === "object" && "response" in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      onError(message || `Could not upload ${label.toLowerCase()}.`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-3 rounded-xl border border-white/10 bg-black/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <img src={fileUrl(imageUrl)} alt="" className="h-16 w-20 shrink-0 rounded-lg bg-white/10 object-contain" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{label}</p>
          <p className="truncate text-xs text-white/40">{imageUrl}</p>
        </div>
      </div>
      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-center text-xs font-bold text-white transition hover:bg-white/10">
        {uploading ? "Uploading…" : "Choose new image"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} disabled={uploading} className="sr-only" />
      </label>
    </div>
  );
}

export default function SiteContentEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const previewDraft = (location.state as { siteContentDraft?: SiteContent } | null)?.siteContentDraft;
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [savedDraft, setSavedDraft] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [revisions, setRevisions] = useState<Array<{ id: string; publishedAt: string; actorName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isDirty = JSON.stringify(content) !== JSON.stringify(savedDraft);

  useEffect(() => {
    api.get<{ draft: SiteContent; revisions: typeof revisions }>("/site-content/admin")
      .then(({ data }) => {
        setContent(previewDraft ?? data.draft);
        setSavedDraft(data.draft);
        setRevisions(data.revisions);
      })
      .catch(() => setError("Could not load saved website content. Check the backend and try again."))
      .finally(() => setLoading(false));
  }, [previewDraft]);

  function updateImage(path: "branding.logoUrl" | "branding.markUrl" | "hero.imageUrl" | "story.patronImageUrl" | "merch.imageUrl", value: string) {
    setContent((current) => {
      if (path === "branding.logoUrl") return { ...current, branding: { ...current.branding, logoUrl: value } };
      if (path === "branding.markUrl") return { ...current, branding: { ...current.branding, markUrl: value } };
      if (path === "hero.imageUrl") return { ...current, hero: { ...current.hero, imageUrl: value } };
      if (path === "story.patronImageUrl") return { ...current, story: { ...current.story, patronImageUrl: value } };
      return { ...current, merch: { ...current.merch, imageUrl: value } };
    });
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.put<{ draft: SiteContent }>("/site-content/draft", content);
      setContent(data.draft);
      setSavedDraft(data.draft);
      setMessage("Draft saved. It is not visible to the public until you publish it.");
    } catch (requestError) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(message || "Could not save website content.");
    } finally {
      setSaving(false);
    }
  }

  async function publishDraft() {
    if (isDirty || !window.confirm("Publish the saved draft to the public website?")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.post<{ revision: { id: string; publishedAt: string; actorName: string } }>("/site-content/publish");
      setRevisions((current) => [data.revision, ...current.filter((revision) => revision.id !== data.revision.id)].slice(0, 20));
      setMessage("Draft published. The previous live version is available in revision history.");
    } catch (requestError) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(message || "Could not publish the saved draft.");
    } finally {
      setSaving(false);
    }
  }

  async function restoreRevision(revisionId: string) {
    if (!window.confirm("Restore this version as the current draft? The public website will not change until you publish it.")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.post<{ draft: SiteContent }>(`/site-content/revisions/${revisionId}/restore`);
      setContent(data.draft);
      setSavedDraft(data.draft);
      setMessage("Revision restored as a draft. Preview it and publish when ready.");
    } catch (requestError) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setError(message || "Could not restore that revision.");
    } finally {
      setSaving(false);
    }
  }

  function setPoster(index: number, field: keyof SiteImage, value: string) {
    setContent((current) => ({
      ...current,
      archive: {
        ...current.archive,
        posters: current.archive.posters.map((poster, posterIndex) => posterIndex === index ? { ...poster, [field]: value } : poster),
      },
    }));
  }

  function setMemberCard(index: number, field: keyof SiteImage, value: string) {
    setContent((current) => ({
      ...current,
      people: {
        ...current.people,
        cards: current.people.cards.map((card, cardIndex) => cardIndex === index ? { ...card, [field]: value } : card),
      },
    }));
  }

  return (
    <div className="min-h-screen px-3 py-5 sm:px-6 sm:py-8">
      <main className="mx-auto w-full max-w-5xl space-y-5">
        <PageHeader eyebrow="Club administration" title="Website content editor" description="Edit a draft, preview your changes, and publish when ready." actions={
          <Link to="/" className="secondary-button min-h-11 px-4">View website</Link>
        } />

        <div className="glass-panel p-4 text-sm leading-6 text-white/65 sm:p-5">
          Save your edits as a draft, preview them, then publish when they are ready. Event posts and tournament details remain managed in their existing screens. Uploaded images accept JPEG, PNG, WEBP, or GIF up to 8 MB.
        </div>
        {error && <p className="error-panel" role="alert">{error}</p>}
        {message && <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-200" role="status">{message}</p>}
        {loading ? <p className="py-8 text-center text-white/55" role="status">Loading website content…</p> : (
          <form onSubmit={saveDraft} className="space-y-5">
            <EditorSection title="Brand and hero" description="Edit the main identity and first section visitors see.">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Club name" value={content.branding.name} onChange={(name) => setContent((current) => ({ ...current, branding: { ...current.branding, name } }))} />
                <TextField label="Club tagline" value={content.branding.tagline} onChange={(tagline) => setContent((current) => ({ ...current, branding: { ...current.branding, tagline } }))} />
                <TextField label="Hero eyebrow" value={content.hero.eyebrow} onChange={(eyebrow) => setContent((current) => ({ ...current, hero: { ...current.hero, eyebrow } }))} />
                <TextField label="Headline, first line" value={content.hero.titleFirst} onChange={(titleFirst) => setContent((current) => ({ ...current, hero: { ...current.hero, titleFirst } }))} />
                <TextField label="Headline, second line" value={content.hero.titleSecond} onChange={(titleSecond) => setContent((current) => ({ ...current, hero: { ...current.hero, titleSecond } }))} />
                <TextArea label="Hero description" value={content.hero.description} onChange={(description) => setContent((current) => ({ ...current, hero: { ...current.hero, description } }))} />
                <TextField label="Hero image accessibility description" value={content.hero.imageAlt} onChange={(imageAlt) => setContent((current) => ({ ...current, hero: { ...current.hero, imageAlt } }))} />
                <TextField label="Location note" value={content.hero.locationNote} onChange={(locationNote) => setContent((current) => ({ ...current, hero: { ...current.hero, locationNote } }))} />
                <TextField label="Primary button label" value={content.hero.primaryButton} onChange={(primaryButton) => setContent((current) => ({ ...current, hero: { ...current.hero, primaryButton } }))} />
                <TextField label="Secondary button label" value={content.hero.secondaryButton} onChange={(secondaryButton) => setContent((current) => ({ ...current, hero: { ...current.hero, secondaryButton } }))} />
              </div>
              <ImageField label="Main logo" imageUrl={content.branding.logoUrl} onChange={(logoUrl) => updateImage("branding.logoUrl", logoUrl)} onError={setError} />
              <ImageField label="Club mark" imageUrl={content.branding.markUrl} onChange={(markUrl) => updateImage("branding.markUrl", markUrl)} onError={setError} />
              <ImageField label="Hero photo" imageUrl={content.hero.imageUrl} onChange={(imageUrl) => updateImage("hero.imageUrl", imageUrl)} onError={setError} />
            </EditorSection>

            <EditorSection title="Upcoming events heading">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <TextField label="Eyebrow" value={content.events.eyebrow} onChange={(eyebrow) => setContent((current) => ({ ...current, events: { ...current.events, eyebrow } }))} />
                <TextField label="Heading" value={content.events.title} onChange={(title) => setContent((current) => ({ ...current, events: { ...current.events, title } }))} />
                <TextField label="Button label" value={content.events.button} onChange={(button) => setContent((current) => ({ ...current, events: { ...current.events, button } }))} />
                <TextField label="Event list heading" value={content.events.listingTitle} onChange={(listingTitle) => setContent((current) => ({ ...current, events: { ...current.events, listingTitle } }))} />
                <TextField label="Browse events link" value={content.events.listingButton} onChange={(listingButton) => setContent((current) => ({ ...current, events: { ...current.events, listingButton } }))} />
              </div>
            </EditorSection>

            <EditorSection title="Our story and namesake">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Eyebrow" value={content.story.eyebrow} onChange={(eyebrow) => setContent((current) => ({ ...current, story: { ...current.story, eyebrow } }))} />
                <TextField label="Heading" value={content.story.title} onChange={(title) => setContent((current) => ({ ...current, story: { ...current.story, title } }))} />
                <TextArea label="First paragraph" value={content.story.paragraphOne} onChange={(paragraphOne) => setContent((current) => ({ ...current, story: { ...current.story, paragraphOne } }))} />
                <TextArea label="Second paragraph" value={content.story.paragraphTwo} onChange={(paragraphTwo) => setContent((current) => ({ ...current, story: { ...current.story, paragraphTwo } }))} />
                <TextField label="Events link label" value={content.story.actionOne} onChange={(actionOne) => setContent((current) => ({ ...current, story: { ...current.story, actionOne } }))} />
                <TextField label="Namesake link label" value={content.story.actionTwo} onChange={(actionTwo) => setContent((current) => ({ ...current, story: { ...current.story, actionTwo } }))} />
                <TextField label="Portrait eyebrow" value={content.story.patronEyebrow} onChange={(patronEyebrow) => setContent((current) => ({ ...current, story: { ...current.story, patronEyebrow } }))} />
                <TextField label="Portrait name" value={content.story.patronName} onChange={(patronName) => setContent((current) => ({ ...current, story: { ...current.story, patronName } }))} />
                <TextField label="Portrait accessibility description" value={content.story.patronImageAlt} onChange={(patronImageAlt) => setContent((current) => ({ ...current, story: { ...current.story, patronImageAlt } }))} />
              </div>
              <ImageField label="Namesake portrait" imageUrl={content.story.patronImageUrl} onChange={(imageUrl) => updateImage("story.patronImageUrl", imageUrl)} onError={setError} />
            </EditorSection>

            <EditorSection title="Club archive">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Eyebrow" value={content.archive.eyebrow} onChange={(eyebrow) => setContent((current) => ({ ...current, archive: { ...current.archive, eyebrow } }))} />
                <TextField label="Heading" value={content.archive.title} onChange={(title) => setContent((current) => ({ ...current, archive: { ...current.archive, title } }))} />
                <TextArea label="Description" value={content.archive.description} onChange={(description) => setContent((current) => ({ ...current, archive: { ...current.archive, description } }))} />
                <TextField label="Button label" value={content.archive.action} onChange={(action) => setContent((current) => ({ ...current, archive: { ...current.archive, action } }))} />
              </div>
              {content.archive.posters.map((poster, index) => (
                <div key={`poster-${index}`} className="space-y-3 rounded-xl border border-white/10 p-3 sm:p-4">
                  <p className="text-sm font-bold text-white">Archive image {index + 1}</p>
                  <ImageField label={`Archive image ${index + 1}`} imageUrl={poster.imageUrl} onChange={(imageUrl) => setPoster(index, "imageUrl", imageUrl)} onError={setError} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Image label" value={poster.label} onChange={(value) => setPoster(index, "label", value)} />
                    <TextField label="Accessibility description" value={poster.alt} onChange={(value) => setPoster(index, "alt", value)} />
                  </div>
                </div>
              ))}
            </EditorSection>

            <EditorSection title="Our people">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Eyebrow" value={content.people.eyebrow} onChange={(eyebrow) => setContent((current) => ({ ...current, people: { ...current.people, eyebrow } }))} />
                <TextField label="Heading" value={content.people.title} onChange={(title) => setContent((current) => ({ ...current, people: { ...current.people, title } }))} />
                <TextArea label="Description" value={content.people.description} onChange={(description) => setContent((current) => ({ ...current, people: { ...current.people, description } }))} />
              </div>
              {content.people.cards.map((card, index) => (
                <div key={`member-${index}`} className="space-y-3 rounded-xl border border-white/10 p-3 sm:p-4">
                  <p className="text-sm font-bold text-white">Community image {index + 1}</p>
                  <ImageField label={`Community image ${index + 1}`} imageUrl={card.imageUrl} onChange={(imageUrl) => setMemberCard(index, "imageUrl", imageUrl)} onError={setError} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Caption" value={card.label} onChange={(value) => setMemberCard(index, "label", value)} />
                    <TextField label="Accessibility description" value={card.alt} onChange={(value) => setMemberCard(index, "alt", value)} />
                  </div>
                </div>
              ))}
            </EditorSection>

            <EditorSection title="Club gear">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Eyebrow" value={content.merch.eyebrow} onChange={(eyebrow) => setContent((current) => ({ ...current, merch: { ...current.merch, eyebrow } }))} />
                <TextField label="Heading" value={content.merch.title} onChange={(title) => setContent((current) => ({ ...current, merch: { ...current.merch, title } }))} />
                <TextArea label="Section description" value={content.merch.description} onChange={(description) => setContent((current) => ({ ...current, merch: { ...current.merch, description } }))} />
                <TextField label="Image caption" value={content.merch.caption} onChange={(caption) => setContent((current) => ({ ...current, merch: { ...current.merch, caption } }))} />
                <TextField label="Image accessibility description" value={content.merch.imageAlt} onChange={(imageAlt) => setContent((current) => ({ ...current, merch: { ...current.merch, imageAlt } }))} />
                <TextField label="Uniform label" value={content.merch.label} onChange={(label) => setContent((current) => ({ ...current, merch: { ...current.merch, label } }))} />
                <TextField label="Uniform headline, first line" value={content.merch.titleFirst} onChange={(titleFirst) => setContent((current) => ({ ...current, merch: { ...current.merch, titleFirst } }))} />
                <TextField label="Uniform headline, second line" value={content.merch.titleSecond} onChange={(titleSecond) => setContent((current) => ({ ...current, merch: { ...current.merch, titleSecond } }))} />
                <TextArea label="Uniform description" value={content.merch.body} onChange={(body) => setContent((current) => ({ ...current, merch: { ...current.merch, body } }))} />
                <TextField label="Button label" value={content.merch.button} onChange={(button) => setContent((current) => ({ ...current, merch: { ...current.merch, button } }))} />
              </div>
              <ImageField label="Club gear photo" imageUrl={content.merch.imageUrl} onChange={(imageUrl) => updateImage("merch.imageUrl", imageUrl)} onError={setError} />
            </EditorSection>

            <EditorSection title="Final call to action">
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField label="Eyebrow" value={content.callToAction.eyebrow} onChange={(eyebrow) => setContent((current) => ({ ...current, callToAction: { ...current.callToAction, eyebrow } }))} />
                <TextField label="Heading" value={content.callToAction.title} onChange={(title) => setContent((current) => ({ ...current, callToAction: { ...current.callToAction, title } }))} />
                <TextField label="Button label" value={content.callToAction.button} onChange={(button) => setContent((current) => ({ ...current, callToAction: { ...current.callToAction, button } }))} />
              </div>
            </EditorSection>

            <EditorSection title="Contact and social links" description="These values are used by the landing page footer. Social and map links must use HTTPS.">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Public location" value={content.contact.location} onChange={(location) => setContent((current) => ({ ...current, contact: { ...current.contact, location } }))} />
                <TextField label="Email" type="email" value={content.contact.email} onChange={(email) => setContent((current) => ({ ...current, contact: { ...current.contact, email } }))} />
                <TextField label="Phone" type="tel" value={content.contact.phone} onChange={(phone) => setContent((current) => ({ ...current, contact: { ...current.contact, phone } }))} />
                <TextField label="Map URL" type="url" value={content.contact.mapUrl} onChange={(mapUrl) => setContent((current) => ({ ...current, contact: { ...current.contact, mapUrl } }))} />
                <TextField label="Instagram URL" type="url" value={content.contact.instagram} onChange={(instagram) => setContent((current) => ({ ...current, contact: { ...current.contact, instagram } }))} />
                <TextField label="Facebook URL" type="url" value={content.contact.facebook} onChange={(facebook) => setContent((current) => ({ ...current, contact: { ...current.contact, facebook } }))} />
                <TextField label="X URL" type="url" value={content.contact.x} onChange={(x) => setContent((current) => ({ ...current, contact: { ...current.contact, x } }))} />
              </div>
            </EditorSection>

            <EditorSection title="Previous published versions" description="The 20 most recently replaced live versions are kept. Restoring one changes only the draft.">
              {revisions.length === 0 ? (
                <p className="text-sm text-white/55">No published revisions yet. The current live version will be saved here the first time you publish.</p>
              ) : (
                <ul className="space-y-3">
                  {revisions.map((revision) => (
                    <li key={revision.id} className="flex flex-col gap-3 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Replaced {new Date(revision.publishedAt).toLocaleString()}</p>
                        <p className="mt-1 text-xs text-white/50">Replaced when {revision.actorName} published a new version</p>
                      </div>
                      <button type="button" className="secondary-button min-h-11 px-4" disabled={saving} onClick={() => restoreRevision(revision.id)}>
                        Restore as draft
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </EditorSection>

            <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border border-white/10 bg-neutral-950/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <p className="text-xs text-white/50">{isDirty ? "Unsaved changes" : "Draft is saved"} · Publishing makes the draft public.</p>
              <div className="grid gap-2 sm:flex">
                <button type="button" disabled={saving || loading} className="secondary-button min-h-12 w-full px-4 sm:w-auto" onClick={() => navigate("/", { state: { siteContentPreview: content } })}>
                  Preview draft
                </button>
                <button type="submit" disabled={saving || loading || !isDirty} className="secondary-button min-h-12 w-full px-4 sm:w-auto">
                  {saving ? "Saving…" : "Save draft"}
                </button>
                <button type="button" disabled={saving || loading || isDirty} className="action-button min-h-12 w-full px-4 sm:w-auto sm:min-w-40" onClick={publishDraft}>
                  {saving ? "Publishing…" : "Publish draft"}
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
