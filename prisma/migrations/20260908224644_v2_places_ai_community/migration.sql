-- Additive only. No table rebuild: every existing row in User and Restaurant
-- is preserved untouched by ADD COLUMN; nothing is dropped, renamed or retyped.

-- AlterTable: User.role
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- Hand-added, non-negotiable: without this the pre-existing admin row
-- silently becomes a community user and locks the owner out of /admin.
-- Must run before any signup exists.
UPDATE "User" SET "role" = 'admin';

-- AlterTable: remaining User columns
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "displayName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");

-- AlterTable: Restaurant, Google Places provenance + AI enrichment state.
-- source defaults to 'manual', correctly labelling every row that exists today.
ALTER TABLE "Restaurant" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Restaurant" ADD COLUMN "placeId" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "placesSyncedAt" DATETIME;
ALTER TABLE "Restaurant" ADD COLUMN "placesRaw" TEXT;
ALTER TABLE "Restaurant" ADD COLUMN "googleRating" REAL;
ALTER TABLE "Restaurant" ADD COLUMN "googleRatingCount" INTEGER;
ALTER TABLE "Restaurant" ADD COLUMN "googlePriceLevel" INTEGER;
ALTER TABLE "Restaurant" ADD COLUMN "aiStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Restaurant" ADD COLUMN "aiApprovedAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_placeId_key" ON "Restaurant"("placeId");
CREATE INDEX "Restaurant_source_idx" ON "Restaurant"("source");
CREATE INDEX "Restaurant_aiStatus_idx" ON "Restaurant"("aiStatus");

-- CreateTable
CREATE TABLE "RestaurantPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "attributions" TEXT NOT NULL DEFAULT '[]',
    "submittedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "aiVerdict" TEXT,
    "aiConfidence" REAL,
    "aiReason" TEXT,
    "wasAutoDecision" BOOLEAN NOT NULL DEFAULT false,
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RestaurantPhoto_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RestaurantPhoto_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RestaurantPhoto_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RestaurantPhoto_restaurantId_status_sortOrder_idx" ON "RestaurantPhoto"("restaurantId", "status", "sortOrder");
CREATE INDEX "RestaurantPhoto_status_createdAt_idx" ON "RestaurantPhoto"("status", "createdAt");
CREATE INDEX "RestaurantPhoto_submittedById_createdAt_idx" ON "RestaurantPhoto"("submittedById", "createdAt");

-- CreateTable
CREATE TABLE "AiProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" TEXT,
    "rawResponse" TEXT,
    "errorMessage" TEXT,
    "overallConfidence" REAL,
    "inputsUsed" TEXT NOT NULL DEFAULT '[]',
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "appliedFields" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiProposal_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiProposal_status_createdAt_idx" ON "AiProposal"("status", "createdAt");
CREATE INDEX "AiProposal_restaurantId_createdAt_idx" ON "AiProposal"("restaurantId", "createdAt");

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");
CREATE UNIQUE INDEX "Favorite_userId_restaurantId_key" ON "Favorite"("userId", "restaurantId");

-- Hand-added data migration: backfill the gallery from existing heroes.
INSERT INTO "RestaurantPhoto" ("id","restaurantId","url","source","status","createdAt","updatedAt")
SELECT lower(hex(randomblob(16))), "id", "image", 'admin', 'approved',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Restaurant" WHERE "image" IS NOT NULL AND "image" != '';
