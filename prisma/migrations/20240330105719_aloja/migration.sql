-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ankyMentorIndex" INTEGER,
ADD COLUMN     "ankyverseDay" INTEGER,
ADD COLUMN     "walletAddress" TEXT;

-- CreateTable
CREATE TABLE "AnkyMentors" (
    "id" TEXT NOT NULL,
    "mentorIndex" INTEGER,
    "owner" TEXT,
    "ankyverseDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnkyMentors_pkey" PRIMARY KEY ("id")
);
