ALTER TABLE "SiteContent" ADD COLUMN "draft" JSONB;

CREATE TABLE "SiteContentRevision" (
    "id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,

    CONSTRAINT "SiteContentRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteContentRevision_publishedAt_idx" ON "SiteContentRevision"("publishedAt");
