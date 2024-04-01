/*
  Warnings:

  - A unique constraint covering the columns `[mentorIndex]` on the table `AnkyMentors` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AnkyMentors_mentorIndex_key" ON "AnkyMentors"("mentorIndex");
