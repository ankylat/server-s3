const fs = require("fs").promises;
const path = require("path");
const express = require("express");
const router = express.Router();

router.get("/:wink", async (req, res) => {
  // const apiKey = req.headers["x-api-key"]; // typically API keys are sent in headers
  // const expectedApiKey = process.env.BRUNO_API_KEY; // This should be the actual value of your API key

  // if (!apiKey || apiKey !== expectedApiKey) {
  //   // If the API key is not present or doesn't match, return an unauthorized error
  //   return res.status(401).json({ error: "Unauthorized access" });
  // }

  const wink = req.params.wink;
  try {
    const bookDir = path.join(__dirname, "../lib/book"); // Adjust the path as necessary
    const chapter = await fs.readFile(
      path.join(bookDir, `chapters/${wink - 1}.txt`),
      "utf8"
    );
    const promptEnglish = await fs.readFile(
      path.join(bookDir, `daily-prompts/en/${wink}.txt`),
      "utf8"
    );
    const promptSpanish = await fs.readFile(
      path.join(bookDir, `daily-prompts/es/${wink}.txt`),
      "utf8"
    );
    const prompts = { en: promptEnglish, es: promptSpanish };
    const userWritings = await fs.readFile(
      path.join(bookDir, `daily-writings/${wink}.txt`),
      "utf8"
    );
    const userFeedbackForChapter = await fs.readFile(
      path.join(bookDir, `feedback-from-users/${wink - 1}.txt`),
      "utf8"
    );
    const summaryOfChapter = await fs.readFile(
      path.join(bookDir, `summary-of-chapters/${wink - 1}.txt`),
      "utf8"
    );
    const superPrompt = await fs.readFile(
      path.join(bookDir, `super-prompts/${wink - 1}.txt`),
      "utf8"
    );
    const jpComments = await fs.readFile(
      path.join(bookDir, `jp-comments/${wink}.txt`),
      "utf8"
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
  } catch (error) {
    console.log(
      `There was an error retrieving the book data for wink ${wink}`,
      error
    );
    return res.status(500).json({
      message: `There was an error retrieving the book data for wink ${wink}`,
    });
  }
});

module.exports = router;
