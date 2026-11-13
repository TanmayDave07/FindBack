/*
  Warnings:

  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('LOST', 'FOUND');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('ACTIVE', 'MATCHED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "lostReportId" TEXT NOT NULL,
    "foundReportId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foundReportId" TEXT NOT NULL,
    "matchId" TEXT,
    "message" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "verifiedById" TEXT,
    "question" TEXT NOT NULL,
    "expectedAnswerHash" TEXT NOT NULL,
    "submittedAnswerHash" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "handedOverById" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "handedOverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Handover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE INDEX "ItemReport_type_status_idx" ON "ItemReport"("type", "status");

-- CreateIndex
CREATE INDEX "ItemReport_categoryId_type_idx" ON "ItemReport"("categoryId", "type");

-- CreateIndex
CREATE INDEX "ItemReport_locationId_type_idx" ON "ItemReport"("locationId", "type");

-- CreateIndex
CREATE INDEX "ItemReport_eventDate_idx" ON "ItemReport"("eventDate");

-- CreateIndex
CREATE INDEX "ItemReport_userId_createdAt_idx" ON "ItemReport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Match_lostReportId_score_idx" ON "Match"("lostReportId", "score");

-- CreateIndex
CREATE INDEX "Match_foundReportId_idx" ON "Match"("foundReportId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_lostReportId_foundReportId_key" ON "Match"("lostReportId", "foundReportId");

-- CreateIndex
CREATE INDEX "Claim_foundReportId_status_idx" ON "Claim"("foundReportId", "status");

-- CreateIndex
CREATE INDEX "Claim_userId_idx" ON "Claim"("userId");

-- CreateIndex
CREATE INDEX "Verification_claimId_idx" ON "Verification"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "Handover_claimId_key" ON "Handover"("claimId");

-- AddForeignKey
ALTER TABLE "ItemReport" ADD CONSTRAINT "ItemReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReport" ADD CONSTRAINT "ItemReport_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReport" ADD CONSTRAINT "ItemReport_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_lostReportId_fkey" FOREIGN KEY ("lostReportId") REFERENCES "ItemReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_foundReportId_fkey" FOREIGN KEY ("foundReportId") REFERENCES "ItemReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_foundReportId_fkey" FOREIGN KEY ("foundReportId") REFERENCES "ItemReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_handedOverById_fkey" FOREIGN KEY ("handedOverById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
