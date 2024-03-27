-- CreateTable
CREATE TABLE "User" (
    "privyId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),
    "streak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER DEFAULT 0,
    "newenBalance" INTEGER NOT NULL DEFAULT 0,
    "totalNewenEarned" INTEGER NOT NULL DEFAULT 0,
    "lastNotified" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("privyId")
);

-- CreateTable
CREATE TABLE "Emails" (
    "id" SERIAL NOT NULL,
    "email" TEXT,

    CONSTRAINT "Emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Newen" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Newen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewenTransaction" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cid" TEXT,

    CONSTRAINT "NewenTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "newenEarned" INTEGER NOT NULL,
    "writingCID" TEXT,
    "status" TEXT,
    "randomUUID" TEXT,

    CONSTRAINT "WritingSession_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Newen" ADD CONSTRAINT "Newen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewenTransaction" ADD CONSTRAINT "NewenTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingSession" ADD CONSTRAINT "WritingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("privyId") ON DELETE RESTRICT ON UPDATE CASCADE;
