-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "heaviness" INTEGER NOT NULL DEFAULT 50,
    "portionSize" INTEGER NOT NULL DEFAULT 50,
    "fineDining" INTEGER NOT NULL DEFAULT 50,
    "priceLevel" INTEGER NOT NULL DEFAULT 2,
    "spiceLevel" INTEGER NOT NULL DEFAULT 50,
    "avgPrepTime" INTEGER NOT NULL DEFAULT 30,
    "cuisines" TEXT NOT NULL DEFAULT '[]',
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "websiteUrl" TEXT,
    "gmapsUrl" TEXT,
    "phone" TEXT,
    "image" TEXT,
    "lat" REAL,
    "lng" REAL,
    "openHours" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_name_key" ON "Restaurant"("name");

-- CreateIndex
CREATE INDEX "Restaurant_heaviness_idx" ON "Restaurant"("heaviness");

-- CreateIndex
CREATE INDEX "Restaurant_portionSize_idx" ON "Restaurant"("portionSize");

-- CreateIndex
CREATE INDEX "Restaurant_fineDining_idx" ON "Restaurant"("fineDining");

-- CreateIndex
CREATE INDEX "Restaurant_priceLevel_idx" ON "Restaurant"("priceLevel");
