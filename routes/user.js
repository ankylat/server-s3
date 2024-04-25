const express = require("express");
const prisma = require("../lib/prismaClient");
const router = express.Router();

router.get("/get-writing-sessions", async (req, res) => {
  try {
    const { wallet, userPrivyId } = req.query;
    const userWritingSessions = await prisma.writingSession.findMany({
      where: {
        userId: userPrivyId,
        sessionDuration: {
          gt: 400, // 'gt' stands for 'greater than'
        },
      },
      orderBy: {
        startTime: "desc", // Optionally ordering by startTime descending
      },
    });
    return res.status(200).json({ writingSessions: userWritingSessions });
  } catch (error) {
    console.log(
      "there was an error retrieving the user writing sessions",
      error
    );
    return {};
  }
});

module.exports = router;
