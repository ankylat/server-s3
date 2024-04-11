const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const router = express.Router();

router.get("/:wink", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  const expectedApiKey = process.env.BRUNO_API_KEY;

  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: "Unauthorized access" });
  }

  const wink = req.params.wink;
  const bookDir = path.join(__dirname, "../lib/book");

  // Helper function to read file and return null if doesn't exist or is empty
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
    prompts,
    userWritings,
    superPrompt,
    chapter,
    summaryOfChapter,
    userFeedbackForChapter,
    jpComments,
  };

  res.json(dataToReturn);
});

module.exports = router;
