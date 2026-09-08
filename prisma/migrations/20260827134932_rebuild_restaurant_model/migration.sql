/*
  Warnings:

  - Added the required column `slug` to the `Restaurant` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "heaviness" INTEGER NOT NULL DEFAULT 50,
    "portionSize" INTEGER NOT NULL DEFAULT 50,
    "fineDining" INTEGER NOT NULL DEFAULT 50,
    "spiceLevel" INTEGER NOT NULL DEFAULT 0,
    "priceLevel" INTEGER NOT NULL DEFAULT 2,
    "avgPrepTime" INTEGER NOT NULL DEFAULT 30,
    "cuisines" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "lat" REAL,
    "lng" REAL,
    "woltUrl" TEXT,
    "websiteUrl" TEXT,
    "instagramUrl" TEXT,
    "gmapsUrl" TEXT,
    "phone" TEXT,
    "image" TEXT,
    "openHours" TEXT,
    "rating" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Restaurant" ("avgPrepTime", "createdAt", "cuisines", "description", "fineDining", "gmapsUrl", "heaviness", "id", "image", "lat", "lng", "name", "neighborhood", "openHours", "phone", "portionSize", "priceLevel", "spiceLevel", "updatedAt", "websiteUrl") SELECT "avgPrepTime", "createdAt", "cuisines", "description", "fineDining", "gmapsUrl", "heaviness", "id", "image", "lat", "lng", "name", "neighborhood", "openHours", "phone", "portionSize", "priceLevel", "spiceLevel", "updatedAt", "websiteUrl" FROM "Restaurant";
DROP TABLE "Restaurant";
ALTER TABLE "new_Restaurant" RENAME TO "Restaurant";
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");
CREATE UNIQUE INDEX "Restaurant_name_key" ON "Restaurant"("name");
CREATE INDEX "Restaurant_isActive_idx" ON "Restaurant"("isActive");
CREATE INDEX "Restaurant_priceLevel_idx" ON "Restaurant"("priceLevel");
CREATE INDEX "Restaurant_neighborhood_idx" ON "Restaurant"("neighborhood");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
