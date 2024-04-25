const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const router = express.Router();
const {
  fetchWritingsForWink,
  getAllTheWrittenText,
} = require("../lib/processAnswers");

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

    async function safeReadFile(filePath, json = false) {
      try {
        let content = await fs.readFile(filePath, "utf8");
        if (json) {
          try {
            return JSON.parse(content); // Wrap content in double quotes to form a valid JSON string
          } catch (parseError) {
            console.error(
              "Error parsing JSON after preprocessing:",
              parseError
            );
            return null; // Return null if parsing still fails
          }
        }
        return content || null;
      } catch (error) {
        console.error("Error reading file:", filePath, error);
        return null; // Return null if there's an error reading the file
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
    const userWritings = await fetchWritingsForWink(wink);
    const userFeedbackForChapter = await safeReadFile(
      path.join(bookDir, `feedback-from-users/${wink - 1}.json`),
      true
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
    console.log("there was an error here", error);
    res.status(500).json({ message: "There was an error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const fullText = await getAllTheWrittenText(); // This should fetch your text
    const serializedText = JSON.stringify(fullText).slice(1, -1);
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="initial-scale=1.0">
            <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
            <style>body { margin: 0; overflow: hidden; }</style>
            <title>Generative Art with Text</title>
        </head>
        <body>
            <script>
            const fullText = "${serializedText}";
            let images = [];

            function preload() {
                console.log('preloading images');
                for (let i = 1; i <= 192; i++) {
                    images.push(loadImage('http://192.168.1.3:8080/routes/images/' + i + '.png'));
                    console.log('image preloaded');
                }
            }

            function setup() {
                console.log('opening the setup');
                const canvasWidth = windowWidth * 8;
                const canvasHeight = windowHeight * 8;
                createCanvas(canvasWidth, canvasHeight);
                background(0);
                noLoop();
                console.log('right before the display text and circles');
                displayTextAndCircles(fullText);
            }

            function displayTextAndCircles(txt) {
              console.log('inside the display text and circles');
              const charArray = txt.split('');
              const sentences = txt.split('. ');
              const sentenceSizes = sentences.map(s => s.length);
              const maxSentenceSize = Math.max(...sentenceSizes);

              // Draw circles with images
              sentences.forEach(sentence => {
                const circleSize = map(sentence.length, 0, maxSentenceSize, 10, width / 20);
                const x = random(width);
                const y = random(height);
                const img = random(images);
                image(img, x - circleSize / 2, y - circleSize / 2, circleSize, circleSize);
                
                // Draw black overlay with 50% opacity
                fill(0, 127);
                noStroke();
                ellipse(x, y, circleSize);
              });

              // Draw characters
              textSize(16);
              textAlign(CENTER, CENTER);
              charArray.forEach(char => {
                if (char.trim() !== '') {
                  const x = random(width);
                  const y = random(height);
                  fill(255); // Use white for text for better visibility
                  text(char, x, y);
                }
              });
            }
            </script>
        </body>
        </html>
    `);
  } catch (error) {
    console.log("there was an error here", error);
  }
});

module.exports = router;
