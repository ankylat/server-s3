-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "chapter" INTEGER,
    "text" TEXT NOT NULL,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);
