-- Drops Restaurant.spiceLevel and adds the admin-managed VocabTerm table.
-- CreateTable
CREATE TABLE "VocabTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "labelSq" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
    "source" TEXT NOT NULL DEFAULT 'manual',
    "placeId" TEXT,
    "placesSyncedAt" DATETIME,
    "placesRaw" TEXT,
    "googleRating" REAL,
    "googleRatingCount" INTEGER,
    "googlePriceLevel" INTEGER,
    "aiStatus" TEXT NOT NULL DEFAULT 'none',
    "aiApprovedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Restaurant" ("address", "aiApprovedAt", "aiStatus", "avgPrepTime", "createdAt", "cuisines", "description", "fineDining", "gmapsUrl", "googlePriceLevel", "googleRating", "googleRatingCount", "heaviness", "id", "image", "instagramUrl", "isActive", "isFeatured", "lat", "lng", "name", "neighborhood", "openHours", "phone", "placeId", "placesRaw", "placesSyncedAt", "portionSize", "priceLevel", "rating", "slug", "source", "tags", "updatedAt", "websiteUrl", "woltUrl") SELECT "address", "aiApprovedAt", "aiStatus", "avgPrepTime", "createdAt", "cuisines", "description", "fineDining", "gmapsUrl", "googlePriceLevel", "googleRating", "googleRatingCount", "heaviness", "id", "image", "instagramUrl", "isActive", "isFeatured", "lat", "lng", "name", "neighborhood", "openHours", "phone", "placeId", "placesRaw", "placesSyncedAt", "portionSize", "priceLevel", "rating", "slug", "source", "tags", "updatedAt", "websiteUrl", "woltUrl" FROM "Restaurant";
DROP TABLE "Restaurant";
ALTER TABLE "new_Restaurant" RENAME TO "Restaurant";
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");
CREATE UNIQUE INDEX "Restaurant_name_key" ON "Restaurant"("name");
CREATE UNIQUE INDEX "Restaurant_placeId_key" ON "Restaurant"("placeId");
CREATE INDEX "Restaurant_isActive_idx" ON "Restaurant"("isActive");
CREATE INDEX "Restaurant_priceLevel_idx" ON "Restaurant"("priceLevel");
CREATE INDEX "Restaurant_neighborhood_idx" ON "Restaurant"("neighborhood");
CREATE INDEX "Restaurant_source_idx" ON "Restaurant"("source");
CREATE INDEX "Restaurant_aiStatus_idx" ON "Restaurant"("aiStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "VocabTerm_kind_sortOrder_idx" ON "VocabTerm"("kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VocabTerm_kind_slug_key" ON "VocabTerm"("kind", "slug");

-- ---------------------------------------------------------------------------
-- Data: seed the curated vocabularies and move existing restaurants onto slugs.
-- Safe on data this file has never seen: a known value (a slug, a label with or
-- without diacritics, or a legacy alias from LEGACY_ALIASES in lib/vocab.ts)
-- maps to its slug; anything else is INSERTED as a new active term labelled
-- exactly as it was written, never dropped. The only values removed on purpose
-- are the 'Spicy' cuisine (spice is gone) and a bare city name used as a
-- neighbourhood.
-- ---------------------------------------------------------------------------

INSERT INTO "VocabTerm" ("id", "kind", "slug", "labelSq", "labelEn", "sortOrder", "active", "createdAt", "updatedAt") VALUES
  (lower(hex(randomblob(12))), 'neighborhood', 'qendra', 'Qendra', 'Qendra', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'dardania', 'Dardania', 'Dardania', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'ulpiane', 'Ulpianë', 'Ulpianë', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'bregu-i-diellit', 'Bregu i Diellit', 'Bregu i Diellit', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'pejton', 'Pejton', 'Pejton', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'arberia', 'Arbëria', 'Arbëria', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'tophane', 'Tophane', 'Tophane', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'velania', 'Velania', 'Velania', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'aktash', 'Aktash', 'Aktash', 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'kalabria', 'Kalabria', 'Kalabria', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'prishtina-e-re', 'Prishtina e Re', 'Prishtina e Re', 110, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'lakrishte', 'Lakrishtë', 'Lakrishtë', 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'mati-1', 'Mati 1', 'Mati 1', 130, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'mati-2', 'Mati 2', 'Mati 2', 140, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'kodra-e-trimave', 'Kodra e Trimave', 'Kodra e Trimave', 150, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'taslixhe', 'Taslixhe', 'Taslixhe', 160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'muharrem-fejza', 'Muharrem Fejza', 'Muharrem Fejza', 170, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'kurrizi', 'Kurrizi', 'Kurrizi', 180, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'lagjja-e-spitalit', 'Lagjja e Spitalit', 'Lagjja e Spitalit', 190, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'sofalia', 'Sofalia', 'Sofalia', 200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'rruga-a', 'Rruga A', 'Rruga A', 210, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'rruga-b', 'Rruga B', 'Rruga B', 220, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'rruga-c', 'Rruga C', 'Rruga C', 230, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'qafa', 'Qafa', 'Qafa', 240, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'kodrina', 'Kodrina', 'Kodrina', 250, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'tauk-bahce', 'Tauk Bahçe', 'Tauk Bahçe', 260, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'lagjja-e-muhaxhereve', 'Lagjja e Muhaxherëve', 'Lagjja e Muhaxherëve', 270, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'kolovica', 'Kolovica', 'Kolovica', 280, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'qendresa-e-re', 'Qendresa e Re', 'Qendresa e Re', 290, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'veternik', 'Veternik', 'Veternik', 300, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'neighborhood', 'matiqan', 'Matiqan', 'Matiqan', 310, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'traditional', 'Tradicionale', 'Traditional', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'grill', 'Qebapa & Zgarë', 'Grill & Qebapa', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'burek-pite', 'Burek & Pite', 'Burek & Pies', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'bakery', 'Furrë & Pastiçeri', 'Bakery & Pastry', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'pizza', 'Pica', 'Pizza', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'italian', 'Italiane', 'Italian', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'burgers', 'Burger', 'Burgers', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'fast-food', 'Ushqim i shpejtë', 'Fast food', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'turkish', 'Turke & Döner', 'Turkish & Döner', 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'steakhouse', 'Mish & Biftek', 'Steakhouse', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'seafood', 'Peshk & Fruta deti', 'Fish & Seafood', 110, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'mediterranean', 'Mesdhetare', 'Mediterranean', 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'sushi-asian', 'Sushi & Aziatike', 'Sushi & Asian', 130, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'mexican', 'Meksikane', 'Mexican', 140, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'international', 'Ndërkombëtare', 'International', 150, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'healthy', 'E shëndetshme', 'Healthy', 160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'vegan', 'Vegane', 'Vegan', 170, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'cafe', 'Kafene', 'Café', 180, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'cuisine', 'desserts', 'Ëmbëlsira & Akullore', 'Desserts & Ice cream', 190, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'outdoor-seating', 'Ulëse jashtë', 'Outdoor seating', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'late-night', 'Hapur deri vonë', 'Open late', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'breakfast', 'Mëngjes & brunch', 'Breakfast & brunch', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'specialty-coffee', 'Kafe speciale', 'Specialty coffee', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'delivery', 'Dërgesë', 'Delivery', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'takeout', 'Merr me vete', 'Takeaway', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'vegan-friendly', 'Opsione vegane', 'Vegan options', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'family-friendly', 'Për familje', 'Family-friendly', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'group-friendly', 'Për grupe', 'Good for groups', 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'date-night', 'Për çift', 'Date night', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'live-music', 'Muzikë live', 'Live music', 110, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'budget-friendly', 'Çmime të lira', 'Budget-friendly', 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'reservation-recommended', 'Rezervim i këshilluar', 'Reservations advised', 130, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'parking', 'Parking', 'Parking', 140, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'wifi', 'Wi-Fi', 'Wi-Fi', 150, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'card-payment', 'Pagesë me kartelë', 'Card payments', 160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'non-smoking', 'Pa duhan', 'Smoke-free', 170, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'pet-friendly', 'Lejohen kafshët', 'Pet-friendly', 180, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(12))), 'tag', 'halal', 'Hallall', 'Halal', 190, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TEMP TABLE "_VocabAlias" ("kind" TEXT NOT NULL, "legacy" TEXT NOT NULL, "slug" TEXT NOT NULL);
INSERT INTO "_VocabAlias" ("kind", "legacy", "slug") VALUES
  ('neighborhood', 'qendra', 'qendra'),
  ('neighborhood', 'dardania', 'dardania'),
  ('neighborhood', 'ulpiane', 'ulpiane'),
  ('neighborhood', 'ulpianë', 'ulpiane'),
  ('neighborhood', 'bregu-i-diellit', 'bregu-i-diellit'),
  ('neighborhood', 'bregu i diellit', 'bregu-i-diellit'),
  ('neighborhood', 'pejton', 'pejton'),
  ('neighborhood', 'arberia', 'arberia'),
  ('neighborhood', 'arbëria', 'arberia'),
  ('neighborhood', 'tophane', 'tophane'),
  ('neighborhood', 'velania', 'velania'),
  ('neighborhood', 'aktash', 'aktash'),
  ('neighborhood', 'kalabria', 'kalabria'),
  ('neighborhood', 'prishtina-e-re', 'prishtina-e-re'),
  ('neighborhood', 'prishtina e re', 'prishtina-e-re'),
  ('neighborhood', 'lakrishte', 'lakrishte'),
  ('neighborhood', 'lakrishtë', 'lakrishte'),
  ('neighborhood', 'mati-1', 'mati-1'),
  ('neighborhood', 'mati 1', 'mati-1'),
  ('neighborhood', 'mati-2', 'mati-2'),
  ('neighborhood', 'mati 2', 'mati-2'),
  ('neighborhood', 'kodra-e-trimave', 'kodra-e-trimave'),
  ('neighborhood', 'kodra e trimave', 'kodra-e-trimave'),
  ('neighborhood', 'taslixhe', 'taslixhe'),
  ('neighborhood', 'muharrem-fejza', 'muharrem-fejza'),
  ('neighborhood', 'muharrem fejza', 'muharrem-fejza'),
  ('neighborhood', 'kurrizi', 'kurrizi'),
  ('neighborhood', 'lagjja-e-spitalit', 'lagjja-e-spitalit'),
  ('neighborhood', 'lagjja e spitalit', 'lagjja-e-spitalit'),
  ('neighborhood', 'sofalia', 'sofalia'),
  ('neighborhood', 'rruga-a', 'rruga-a'),
  ('neighborhood', 'rruga a', 'rruga-a'),
  ('neighborhood', 'rruga-b', 'rruga-b'),
  ('neighborhood', 'rruga b', 'rruga-b'),
  ('neighborhood', 'rruga-c', 'rruga-c'),
  ('neighborhood', 'rruga c', 'rruga-c'),
  ('neighborhood', 'qafa', 'qafa'),
  ('neighborhood', 'kodrina', 'kodrina'),
  ('neighborhood', 'tauk-bahce', 'tauk-bahce'),
  ('neighborhood', 'tauk bahçe', 'tauk-bahce'),
  ('neighborhood', 'lagjja-e-muhaxhereve', 'lagjja-e-muhaxhereve'),
  ('neighborhood', 'lagjja e muhaxherëve', 'lagjja-e-muhaxhereve'),
  ('neighborhood', 'kolovica', 'kolovica'),
  ('neighborhood', 'qendresa-e-re', 'qendresa-e-re'),
  ('neighborhood', 'qendresa e re', 'qendresa-e-re'),
  ('neighborhood', 'veternik', 'veternik'),
  ('neighborhood', 'matiqan', 'matiqan'),
  ('neighborhood', 'center', 'qendra'),
  ('neighborhood', 'centre', 'qendra'),
  ('neighborhood', 'city center', 'qendra'),
  ('neighborhood', 'city centre', 'qendra'),
  ('neighborhood', 'downtown', 'qendra'),
  ('neighborhood', 'qendër', 'qendra'),
  ('neighborhood', 'qender', 'qendra'),
  ('neighborhood', 'ulpiana', 'ulpiane'),
  ('neighborhood', 'muhaxheret', 'lagjja-e-muhaxhereve'),
  ('neighborhood', 'prishtina', ''),
  ('neighborhood', 'prishtinë', ''),
  ('neighborhood', 'pristina', ''),
  ('neighborhood', 'priština', ''),
  ('cuisine', 'traditional', 'traditional'),
  ('cuisine', 'tradicionale', 'traditional'),
  ('cuisine', 'grill', 'grill'),
  ('cuisine', 'qebapa & zgarë', 'grill'),
  ('cuisine', 'grill & qebapa', 'grill'),
  ('cuisine', 'qebapa-zgare', 'grill'),
  ('cuisine', 'grill-qebapa', 'grill'),
  ('cuisine', 'burek-pite', 'burek-pite'),
  ('cuisine', 'burek & pite', 'burek-pite'),
  ('cuisine', 'burek & pies', 'burek-pite'),
  ('cuisine', 'burek-pies', 'burek-pite'),
  ('cuisine', 'bakery', 'bakery'),
  ('cuisine', 'furrë & pastiçeri', 'bakery'),
  ('cuisine', 'bakery & pastry', 'bakery'),
  ('cuisine', 'furre-pasticeri', 'bakery'),
  ('cuisine', 'bakery-pastry', 'bakery'),
  ('cuisine', 'pizza', 'pizza'),
  ('cuisine', 'pica', 'pizza'),
  ('cuisine', 'italian', 'italian'),
  ('cuisine', 'italiane', 'italian'),
  ('cuisine', 'burgers', 'burgers'),
  ('cuisine', 'burger', 'burgers'),
  ('cuisine', 'fast-food', 'fast-food'),
  ('cuisine', 'ushqim i shpejtë', 'fast-food'),
  ('cuisine', 'fast food', 'fast-food'),
  ('cuisine', 'ushqim-i-shpejte', 'fast-food'),
  ('cuisine', 'turkish', 'turkish'),
  ('cuisine', 'turke & döner', 'turkish'),
  ('cuisine', 'turkish & döner', 'turkish'),
  ('cuisine', 'turke-doner', 'turkish'),
  ('cuisine', 'turkish-doner', 'turkish'),
  ('cuisine', 'steakhouse', 'steakhouse'),
  ('cuisine', 'mish & biftek', 'steakhouse'),
  ('cuisine', 'mish-biftek', 'steakhouse'),
  ('cuisine', 'seafood', 'seafood'),
  ('cuisine', 'peshk & fruta deti', 'seafood'),
  ('cuisine', 'fish & seafood', 'seafood'),
  ('cuisine', 'peshk-fruta-deti', 'seafood'),
  ('cuisine', 'fish-seafood', 'seafood'),
  ('cuisine', 'mediterranean', 'mediterranean'),
  ('cuisine', 'mesdhetare', 'mediterranean'),
  ('cuisine', 'sushi-asian', 'sushi-asian'),
  ('cuisine', 'sushi & aziatike', 'sushi-asian'),
  ('cuisine', 'sushi & asian', 'sushi-asian'),
  ('cuisine', 'sushi-aziatike', 'sushi-asian'),
  ('cuisine', 'mexican', 'mexican'),
  ('cuisine', 'meksikane', 'mexican'),
  ('cuisine', 'international', 'international'),
  ('cuisine', 'ndërkombëtare', 'international'),
  ('cuisine', 'nderkombetare', 'international'),
  ('cuisine', 'healthy', 'healthy'),
  ('cuisine', 'e shëndetshme', 'healthy'),
  ('cuisine', 'e-shendetshme', 'healthy'),
  ('cuisine', 'vegan', 'vegan'),
  ('cuisine', 'vegane', 'vegan'),
  ('cuisine', 'cafe', 'cafe'),
  ('cuisine', 'kafene', 'cafe'),
  ('cuisine', 'café', 'cafe'),
  ('cuisine', 'desserts', 'desserts'),
  ('cuisine', 'ëmbëlsira & akullore', 'desserts'),
  ('cuisine', 'desserts & ice cream', 'desserts'),
  ('cuisine', 'Ëmbëlsira & akullore', 'desserts'),
  ('cuisine', 'embelsira-akullore', 'desserts'),
  ('cuisine', 'desserts-ice-cream', 'desserts'),
  ('cuisine', 'kosovan', 'traditional'),
  ('cuisine', 'balkan', 'traditional'),
  ('cuisine', 'albanian', 'traditional'),
  ('cuisine', 'kosovar', 'traditional'),
  ('cuisine', 'qebapa', 'grill'),
  ('cuisine', 'bbq', 'grill'),
  ('cuisine', 'barbecue', 'grill'),
  ('cuisine', 'burek', 'burek-pite'),
  ('cuisine', 'pite', 'burek-pite'),
  ('cuisine', 'pastry', 'bakery'),
  ('cuisine', 'pasta', 'italian'),
  ('cuisine', 'american', 'burgers'),
  ('cuisine', 'street food', 'fast-food'),
  ('cuisine', 'fine dining', 'international'),
  ('cuisine', 'french', 'international'),
  ('cuisine', 'modern european', 'international'),
  ('cuisine', 'european', 'international'),
  ('cuisine', 'japanese', 'sushi-asian'),
  ('cuisine', 'sushi', 'sushi-asian'),
  ('cuisine', 'ramen', 'sushi-asian'),
  ('cuisine', 'chinese', 'sushi-asian'),
  ('cuisine', 'szechuan', 'sushi-asian'),
  ('cuisine', 'asian', 'sushi-asian'),
  ('cuisine', 'thai', 'sushi-asian'),
  ('cuisine', 'tacos', 'mexican'),
  ('cuisine', 'salads', 'healthy'),
  ('cuisine', 'organic', 'healthy'),
  ('cuisine', 'smoothies', 'healthy'),
  ('cuisine', 'coffee', 'cafe'),
  ('cuisine', 'doner', 'turkish'),
  ('cuisine', 'döner', 'turkish'),
  ('cuisine', 'kebab', 'turkish'),
  ('cuisine', 'fish', 'seafood'),
  ('cuisine', 'ice cream', 'desserts'),
  ('cuisine', 'steak', 'steakhouse'),
  ('cuisine', 'spicy', ''),
  ('tag', 'outdoor-seating', 'outdoor-seating'),
  ('tag', 'ulëse jashtë', 'outdoor-seating'),
  ('tag', 'outdoor seating', 'outdoor-seating'),
  ('tag', 'ulese-jashte', 'outdoor-seating'),
  ('tag', 'late-night', 'late-night'),
  ('tag', 'hapur deri vonë', 'late-night'),
  ('tag', 'open late', 'late-night'),
  ('tag', 'hapur-deri-vone', 'late-night'),
  ('tag', 'open-late', 'late-night'),
  ('tag', 'breakfast', 'breakfast'),
  ('tag', 'mëngjes & brunch', 'breakfast'),
  ('tag', 'breakfast & brunch', 'breakfast'),
  ('tag', 'mengjes-brunch', 'breakfast'),
  ('tag', 'breakfast-brunch', 'breakfast'),
  ('tag', 'specialty-coffee', 'specialty-coffee'),
  ('tag', 'kafe speciale', 'specialty-coffee'),
  ('tag', 'specialty coffee', 'specialty-coffee'),
  ('tag', 'kafe-speciale', 'specialty-coffee'),
  ('tag', 'delivery', 'delivery'),
  ('tag', 'dërgesë', 'delivery'),
  ('tag', 'dergese', 'delivery'),
  ('tag', 'takeout', 'takeout'),
  ('tag', 'merr me vete', 'takeout'),
  ('tag', 'takeaway', 'takeout'),
  ('tag', 'merr-me-vete', 'takeout'),
  ('tag', 'vegan-friendly', 'vegan-friendly'),
  ('tag', 'opsione vegane', 'vegan-friendly'),
  ('tag', 'vegan options', 'vegan-friendly'),
  ('tag', 'opsione-vegane', 'vegan-friendly'),
  ('tag', 'vegan-options', 'vegan-friendly'),
  ('tag', 'family-friendly', 'family-friendly'),
  ('tag', 'për familje', 'family-friendly'),
  ('tag', 'per-familje', 'family-friendly'),
  ('tag', 'group-friendly', 'group-friendly'),
  ('tag', 'për grupe', 'group-friendly'),
  ('tag', 'good for groups', 'group-friendly'),
  ('tag', 'per-grupe', 'group-friendly'),
  ('tag', 'good-for-groups', 'group-friendly'),
  ('tag', 'date-night', 'date-night'),
  ('tag', 'për çift', 'date-night'),
  ('tag', 'date night', 'date-night'),
  ('tag', 'per-cift', 'date-night'),
  ('tag', 'live-music', 'live-music'),
  ('tag', 'muzikë live', 'live-music'),
  ('tag', 'live music', 'live-music'),
  ('tag', 'muzike-live', 'live-music'),
  ('tag', 'budget-friendly', 'budget-friendly'),
  ('tag', 'çmime të lira', 'budget-friendly'),
  ('tag', 'Çmime të lira', 'budget-friendly'),
  ('tag', 'cmime-te-lira', 'budget-friendly'),
  ('tag', 'reservation-recommended', 'reservation-recommended'),
  ('tag', 'rezervim i këshilluar', 'reservation-recommended'),
  ('tag', 'reservations advised', 'reservation-recommended'),
  ('tag', 'rezervim-i-keshilluar', 'reservation-recommended'),
  ('tag', 'reservations-advised', 'reservation-recommended'),
  ('tag', 'parking', 'parking'),
  ('tag', 'wifi', 'wifi'),
  ('tag', 'wi-fi', 'wifi'),
  ('tag', 'card-payment', 'card-payment'),
  ('tag', 'pagesë me kartelë', 'card-payment'),
  ('tag', 'card payments', 'card-payment'),
  ('tag', 'pagese-me-kartele', 'card-payment'),
  ('tag', 'card-payments', 'card-payment'),
  ('tag', 'non-smoking', 'non-smoking'),
  ('tag', 'pa duhan', 'non-smoking'),
  ('tag', 'smoke-free', 'non-smoking'),
  ('tag', 'pa-duhan', 'non-smoking'),
  ('tag', 'pet-friendly', 'pet-friendly'),
  ('tag', 'lejohen kafshët', 'pet-friendly'),
  ('tag', 'lejohen-kafshet', 'pet-friendly'),
  ('tag', 'halal', 'halal'),
  ('tag', 'hallall', 'halal'),
  ('tag', 'brunch', 'breakfast'),
  ('tag', 'romantic', 'date-night'),
  ('tag', 'take-away', 'takeout'),
  ('tag', 'vegetarian', 'vegan-friendly'),
  ('tag', 'kid-friendly', 'family-friendly');

-- cuisines: unknown values become cuisine terms (label = the value as it was
-- written, sorted after the curated ones), then every array is rewritten to
-- slugs, de-duplicated, first-occurrence order kept. Rows whose column is not
-- a JSON array are left exactly as they were (toDTO already reads them as []).
INSERT OR IGNORE INTO "VocabTerm" ("id", "kind", "slug", "labelSq", "labelEn", "sortOrder", "active", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(12))), 'cuisine', lower(replace(replace(trim(j."value"), ' ', '-'), ',', '-')), trim(j."value"), trim(j."value"), 1000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Restaurant" r, json_each(CASE WHEN json_valid(r."cuisines") THEN CASE WHEN json_type(r."cuisines") = 'array' THEN r."cuisines" ELSE '[]' END ELSE '[]' END) j
WHERE j."type" = 'text' AND trim(j."value") <> '' AND NOT EXISTS (SELECT 1 FROM "_VocabAlias" a WHERE a."kind" = 'cuisine' AND (a."legacy" = lower(trim(j."value")) OR a."legacy" = lower(replace(replace(trim(j."value"), ' ', '-'), ',', '-'))));

UPDATE "Restaurant" SET "cuisines" = (
  SELECT json_group_array(s) FROM (
    SELECT s FROM (
      SELECT COALESCE((SELECT a."slug" FROM "_VocabAlias" a WHERE a."kind" = 'cuisine' AND (a."legacy" = lower(trim(j."value")) OR a."legacy" = lower(replace(replace(trim(j."value"), ' ', '-'), ',', '-'))) LIMIT 1), lower(replace(replace(trim(j."value"), ' ', '-'), ',', '-'))) AS s, j."key" AS k
      FROM json_each(CASE WHEN json_valid("Restaurant"."cuisines") THEN CASE WHEN json_type("Restaurant"."cuisines") = 'array' THEN "Restaurant"."cuisines" ELSE '[]' END ELSE '[]' END) j
      WHERE j."type" = 'text' AND trim(j."value") <> ''
    )
    WHERE s <> ''
    GROUP BY s
    ORDER BY MIN(k)
  )
)
WHERE (CASE WHEN json_valid("cuisines") THEN CASE WHEN json_type("cuisines") = 'array' THEN "cuisines" ELSE '[]' END ELSE '[]' END) <> '[]';

-- tags: unknown values become tag terms (label = the value as it was
-- written, sorted after the curated ones), then every array is rewritten to
-- slugs, de-duplicated, first-occurrence order kept. Rows whose column is not
-- a JSON array are left exactly as they were (toDTO already reads them as []).
INSERT OR IGNORE INTO "VocabTerm" ("id", "kind", "slug", "labelSq", "labelEn", "sortOrder", "active", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(12))), 'tag', lower(replace(replace(trim(j."value"), ' ', '-'), ',', '-')), trim(j."value"), trim(j."value"), 1000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Restaurant" r, json_each(CASE WHEN json_valid(r."tags") THEN CASE WHEN json_type(r."tags") = 'array' THEN r."tags" ELSE '[]' END ELSE '[]' END) j
WHERE j."type" = 'text' AND trim(j."value") <> '' AND NOT EXISTS (SELECT 1 FROM "_VocabAlias" a WHERE a."kind" = 'tag' AND (a."legacy" = lower(trim(j."value")) OR a."legacy" = lower(replace(replace(trim(j."value"), ' ', '-'), ',', '-'))));

UPDATE "Restaurant" SET "tags" = (
  SELECT json_group_array(s) FROM (
    SELECT s FROM (
      SELECT COALESCE((SELECT a."slug" FROM "_VocabAlias" a WHERE a."kind" = 'tag' AND (a."legacy" = lower(trim(j."value")) OR a."legacy" = lower(replace(replace(trim(j."value"), ' ', '-'), ',', '-'))) LIMIT 1), lower(replace(replace(trim(j."value"), ' ', '-'), ',', '-'))) AS s, j."key" AS k
      FROM json_each(CASE WHEN json_valid("Restaurant"."tags") THEN CASE WHEN json_type("Restaurant"."tags") = 'array' THEN "Restaurant"."tags" ELSE '[]' END ELSE '[]' END) j
      WHERE j."type" = 'text' AND trim(j."value") <> ''
    )
    WHERE s <> ''
    GROUP BY s
    ORDER BY MIN(k)
  )
)
WHERE (CASE WHEN json_valid("tags") THEN CASE WHEN json_type("tags") = 'array' THEN "tags" ELSE '[]' END ELSE '[]' END) <> '[]';

-- neighborhood: the same rule for a single value.
INSERT OR IGNORE INTO "VocabTerm" ("id", "kind", "slug", "labelSq", "labelEn", "sortOrder", "active", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(12))), 'neighborhood', lower(replace(replace(trim(r."neighborhood"), ' ', '-'), ',', '-')), trim(r."neighborhood"), trim(r."neighborhood"), 1000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Restaurant" r
WHERE trim(r."neighborhood") <> '' AND NOT EXISTS (SELECT 1 FROM "_VocabAlias" a WHERE a."kind" = 'neighborhood' AND (a."legacy" = lower(trim(r."neighborhood")) OR a."legacy" = lower(replace(replace(trim(r."neighborhood"), ' ', '-'), ',', '-'))));

UPDATE "Restaurant"
SET "neighborhood" = COALESCE((SELECT a."slug" FROM "_VocabAlias" a WHERE a."kind" = 'neighborhood' AND (a."legacy" = lower(trim("Restaurant"."neighborhood")) OR a."legacy" = lower(replace(replace(trim("Restaurant"."neighborhood"), ' ', '-'), ',', '-'))) LIMIT 1), lower(replace(replace(trim("Restaurant"."neighborhood"), ' ', '-'), ',', '-')))
WHERE trim("neighborhood") <> '';

UPDATE "Restaurant" SET "neighborhood" = '' WHERE trim("neighborhood") = '' AND "neighborhood" <> '';

DROP TABLE "_VocabAlias";
