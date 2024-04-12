const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const router = express.Router();

router.get("/:wink", async (req, res) => {
  try {
    const wink = Number(req.params.wink); // Make sure wink is an integer
    const startingTimestamp = 1711861200;
    const thisWinkStartingTimestamp = startingTimestamp + wink * 86400;
    const thisWinkEndingTimestamp = startingTimestamp + (wink + 1) * 86400;

    const apiKey = req.headers["x-api-key"];
    const expectedApiKey = process.env.BRUNO_API_KEY;

    if (!apiKey || apiKey !== expectedApiKey) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const bookDir = path.join(__dirname, "../lib/book");

    async function safeReadFile(filePath) {
      try {
        const content = await fs.readFile(filePath, "utf8");
        return content || null;
      } catch (error) {
        return null; // Return null if the file doesn't exist or any error occurs
      }
    }

    // Using the helper function to safely read the files
    const chapter = await safeReadFile(
      path.join(bookDir, `chapters/${wink - 1}.txt`)
    );
    const promptEnglish = await safeReadFile(
      path.join(bookDir, `daily-prompts/en/${wink}.txt`)
    );
    const promptSpanish = await safeReadFile(
      path.join(bookDir, `daily-prompts/es/${wink}.txt`)
    );
    const prompts = { en: promptEnglish, es: promptSpanish };
    const userWritings = await safeReadFile(
      path.join(bookDir, `daily-writings/${wink}.txt`)
    );
    const userFeedbackForChapter = await safeReadFile(
      path.join(bookDir, `feedback-from-users/${wink - 1}.txt`)
    );
    const summaryOfChapter = await safeReadFile(
      path.join(bookDir, `summary-of-chapters/${wink - 1}.txt`)
    );
    const superPrompt = await safeReadFile(
      path.join(bookDir, `super-prompts/${wink - 1}.txt`)
    );
    const jpComments = await safeReadFile(
      path.join(bookDir, `jp-comments/${wink}.txt`)
    );

    const dataToReturn = {
      wink,
      thisWinkStartingTimestamp,
      thisWinkEndingTimestamp,
      prompts,
      userWritings,
      superPrompt,
      chapter,
      summaryOfChapter,
      userFeedbackForChapter,
      jpComments,
    };

    res.status(200).json(dataToReturn);
  } catch (error) {
    console.log("there was an error here");
    res.status(500).json({ message: "There was an error" });
  }
});

module.exports = router;
