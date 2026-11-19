-- Keep serial numbers, wallet contents, and other proof of ownership private.
ALTER TABLE "ItemReport" ADD COLUMN "privateDetails" TEXT;
