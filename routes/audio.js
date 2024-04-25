const express = require("express");
const prisma = require("../lib/prismaClient");
const router = express.Router();
const fs = require("fs");
const OpenAI = require("openai");
const multer = require("multer");
const path = require("path");

const openai = new OpenAI(process.env.OPENAI_API_KEY);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Using the absolute path you've defined earlier
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

router.post("/transcribe", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  // Check if the file actually exists
  if (!fs.existsSync(file.path)) {
    return res.status(500).send("Uploaded file is missing.");
  }

  try {
    // Read the uploaded file from the filesystem
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(file.path),
      model: "whisper-1",
    });

    // Clean up: Delete the file after processing
    fs.unlinkSync(file.path);

    // Send transcription result back to the client
    res.send({ text: transcription.text });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    res.status(500).send("Error processing audio file");
  }
});

module.exports = router;
