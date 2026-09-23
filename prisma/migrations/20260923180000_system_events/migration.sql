CREATE TABLE "SystemEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "area" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SystemEvent_createdAt_idx" ON "SystemEvent"("createdAt");
CREATE INDEX "SystemEvent_area_createdAt_idx" ON "SystemEvent"("area", "createdAt");
