CREATE TABLE "NearbyLocation" (
  "locationId" TEXT NOT NULL,
  "nearbyLocationId" TEXT NOT NULL,
  CONSTRAINT "NearbyLocation_pkey" PRIMARY KEY ("locationId", "nearbyLocationId"),
  CONSTRAINT "NearbyLocation_locationId_fkey" FOREIGN KEY ("locationId")
    REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NearbyLocation_nearbyLocationId_fkey" FOREIGN KEY ("nearbyLocationId")
    REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "NearbyLocation_nearbyLocationId_idx" ON "NearbyLocation"("nearbyLocationId");
