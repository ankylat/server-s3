require("dotenv").config();
const cors = require("cors");
const express = require("express");
const prisma = require("./lib/prismaClient");
const { PrivyClient } = require("@privy-io/server-auth");
const cron = require("node-cron");
const fs = require("fs").promises;
const path = require("path");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");
const moment = require("moment");
const { getAnkyverseDay } = require("./lib/ankyverse");
const {
  fetchWritingsForWink,
  calculateStatsForResonanceWave,
  fetchAllWritingsByWink,
} = require("./lib/processAnswers");
const mentorsAbi = require("./lib/mentorsAbi.json");

const bookRoutes = require("./routes/bookRoutes");

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);

const contractAddress = "0x6d622549842Bc73A8F2bE146A27F026B646Bf6a1";

const mentorsContract = new ethers.Contract(
  contractAddress,
  mentorsAbi,
  provider
);

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
const port = 3000;

app.use("/book-data", bookRoutes);

const minimumWritingTime = 7;

async function startNewDayOnTheAnkyverse() {
  try {
    await prisma.user.updateMany({
      data: {
        wroteToday: false,
        todayCid: "",
      },
    });
    updateMentorOwners();
    downloadWritingsOfDayThatJustFinished();
    console.log("Successfully reset wroteToday for all users");
  } catch (error) {
    console.error("Error resetting wroteToday for users:", error);
  }
}

function scheduleStartNewDayOnTheAnkyverse() {
  const startDate = new Date(1711861200 * 1000); // Convert to milliseconds
  const hour = startDate.getUTCHours();
  const minute = startDate.getUTCMinutes();
  const second = startDate.getUTCSeconds();

  // Cron syntax: second minute hour * * *
  const cronTime = `${second} ${minute} ${hour} * * *`;
  console.log("scheduling the start again", cronTime);
  cron.schedule(cronTime, () => {
    console.log("startAgain function is triggered");
    startNewDayOnTheAnkyverse();
  });

  console.log(`Scheduled to run every day at ${hour}:${minute}:${second} UTC`);
}

scheduleStartNewDayOnTheAnkyverse();

function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function updateMentorOwners() {
  const ankyverseDay = getAnkyverseDay(new Date());

  const mentorOwners = [];
  let newOwners = "";

  for (let tokenId = 1; tokenId <= 192; tokenId++) {
    try {
      const newOwner = await mentorsContract.ownerOf(tokenId);
      console.log(`Token ID ${tokenId} is owned by ${newOwner}`);

      const mentorRecord = await prisma.ankyMentors.findUnique({
        where: { mentorIndex: tokenId },
      });

      if (mentorRecord && mentorRecord.owner !== newOwner) {
        newOwners += `${newOwner}, `;
        await prisma.ankyMentors.update({
          where: { mentorIndex: tokenId },
          data: {
            owner: newOwner,
            ankyverseDay: ankyverseDay.wink,
            changeCount: { increment: 1 },
          },
        });
        const allowlistEntry = await privy.inviteToAllowlist({
          type: "wallet",
          value: newOwner,
        });
        console.log("the allowlist entry is: ", allowlistEntry);
      }

      mentorOwners.push(newOwner);
      await delay(111); // Ensure delay is a properly defined async function
    } catch (error) {
      console.error(`Error fetching owner for token ID ${tokenId}: ${error}`);
    }
  }
  console.log("all the new owners are: ", newOwners);
}

async function downloadWritingsOfDayThatJustFinished() {
  try {
    const currentDate = new Date();
    currentDate.setHours(currentDate.getHours() - 5);
    const wink = getAnkyverseDay(currentDate);
    const writingsForDayThatIsEnding = await fetchAllWritingsByWink(wink);

    console.log(
      "These are the writings for the day that is ending:",
      writingsForDayThatIsEnding
    );

    // Check if the writings content is not empty
    if (
      !writingsForDayThatIsEnding ||
      writingsForDayThatIsEnding.length === 0
    ) {
      console.error(
        "No writings retrieved or content is empty for wink:",
        wink
      );
      return null; // Optionally, handle this case as needed
    }

    const bookDir = path.join(__dirname, `./lib/book/daily-writings`);
    await fs.mkdir(bookDir, { recursive: true });
    const filePath = path.join(bookDir, `${wink}.txt`);

    await fs.writeFile(filePath, writingsForDayThatIsEnding, "utf8");
    console.log("File written successfully to", filePath);
  } catch (error) {
    console.error("There was an error fetching this day's writings", error);
    return null;
  }
}

// ******** CRON JOBS ***********

cron.schedule("*/30 * * * *", async () => {
  try {
    const expiredSessions = await prisma.writingSession.findMany({
      where: {
        status: "active",
        startTime: {
          lt: new Date(new Date().getTime() - 9 * 60 * 1000), // 8 minutes ago
        },
      },
    });

    if (expiredSessions.length > 0) {
      expiredSessions.forEach(async (session) => {
        await prisma.writingSession.update({
          where: { id: session.id },
          data: { status: "failed" },
        });
      });
    }
  } catch (error) {
    console.error("Error checking for failed sessions:", error);
  }
});

// ********* MIDDLEWARE ***********

const checkIfValidUser = async (req, res, next) => {
  try {
    const authToken = req?.headers?.authorization?.replace("Bearer ", "");
    const verifiedClaims = await privy.verifyAuthToken(authToken);
    next();
  } catch (error) {
    console.error("Authorization failed", error);
    res.status(401).json({ message: "Not authorized" });
  }
};

// ********* ROUTES ***********

app.get("/", (req, res) => {
  res.send("hello world");
});

app.get("/get-writings-by-wink/:winkNumber", async (req, res) => {
  const apiKey = req.headers["x-api-key"]; // typically API keys are sent in headers
  const expectedApiKey = process.env.BRUNO_API_KEY; // This should be the actual value of your API key

  if (!apiKey || apiKey !== expectedApiKey) {
    // If the API key is not present or doesn't match, return an unauthorized error
    return res.status(401).json({ error: "Unauthorized access" });
  }
  try {
    const wink = req.params.winkNumber;
    const writingsForThisWink = await fetchWritingsForWink(wink);
    res.status(200).json({
      wink: wink,
      sojourn: 3,
      writingsForThisWink: writingsForThisWink,
    });
  } catch (error) {
    console.log("there was an error", error);
    res.status(500).json({ writingsOfProvidedWink: null });
  }
});

app.get(
  "/get-stats-for-resonance-wave/:resonanceWaveNumber",
  async (req, res) => {
    try {
      const resonanceWaveNumber = req.params.resonanceWaveNumber;
      const statsForThisResonanceWave = await calculateStatsForResonanceWave(
        resonanceWaveNumber
      );
      res.status(200).json({
        statsForThisResonanceWave: statsForThisResonanceWave,
      });
    } catch (error) {
      console.log("there was an error", error);
      res.status(500).json({ writingsOfProvidedWink: null });
    }
  }
);

app.post("/user/:privyId", checkIfValidUser, async (req, res) => {
  try {
    const privyId = req.params.privyId;
    const walletAddress = req.body.walletAddress;

    const ankyMentor = await prisma.ankyMentors.findFirst({
      where: { owner: walletAddress },
      orderBy: {
        mentorIndex: "asc",
      },
    });

    const user = await prisma.user.upsert({
      where: { privyId },
      update: {},
      create: {
        privyId: privyId,
        walletAddress: walletAddress,
      },
    });

    res.json({ user, mentor: ankyMentor });
  } catch (error) {
    console.log("there was an error", error);
  }
});

app.post("/check-user", checkIfValidUser, async (req, res) => {
  try {
    const { privyId } = req.body;

    const privyUser = await privy.getUser(`did:privy:${privyId}`);
    if (!privyUser)
      return res.status(500).json({ message: "You are not authorized here" });

    let user = await prisma.user.findUnique({
      where: { privyId },
    });

    if (!user) {
      // If not, create a new user
      user = await prisma.user.create({
        data: {
          privyId,
        },
      });
    } else {
      // If yes, update the last login time
      user = await prisma.user.update({
        where: { privyId },
        data: {
          lastLogin: new Date(),
        },
      });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error handling user login:", error);
    res
      .status(500)
      .json({ message: "Error logging in user", error: error.message });
  }
});

app.post("/start-session", checkIfValidUser, async (req, res) => {
  try {
    const userPrivyId = req.body.userPrivyId;
    const now = req.body.timestamp;
    const randomUUID = req.body.randomUUID;
    const userWallet = req.body.wallet;

    // Validate the userPrivyId format and check for an existing active session

    if (!isValidPrivyId(userPrivyId)) {
      return res.status(400).send("Invalid request.");
    }

    const ankyMentor = await prisma.ankyMentors.findFirst({
      where: { owner: userWallet },
      orderBy: {
        mentorIndex: "asc",
      },
    });

    const user = await prisma.user.upsert({
      where: { privyId: userPrivyId },
      update: {},
      create: {
        privyId: userPrivyId,
        walletAddress: userWallet,
      },
    });

    if (ankyMentor.wroteToday || user.wroteToday) {
      return res
        .status(201)
        .json({ message: "this session is invalid, the user already wrote" });
    }
    const ankyverseDay = getAnkyverseDay(new Date());

    const newSession = await prisma.writingSession.create({
      data: {
        userId: userPrivyId,
        startTime: now,
        status: "active",
        randomUUID: randomUUID,
        mentorIndex: ankyMentor.mentorIndex,
        walletAddress: userWallet,
        ankyverseDay: ankyverseDay.wink,
      },
    });

    res.status(201).json(newSession);
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while starting the session.");
  }
});

async function updateStreak(privyId) {
  // Fetch the newen earning records for the user, ordered by date
  const newenRecords = await prisma.newenTransaction.findMany({
    where: {
      userId: privyId,
      type: "earned",
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!newenRecords || newenRecords.length === 0) {
    return { ok: true, streak: 0 };
  }

  let dailyStreak = 1; // Start with a streak of 1

  for (let i = 1; i < newenRecords.length; i++) {
    const prevDate = new Date(newenRecords[i - 1].createdAt);
    const currDate = new Date(newenRecords[i].createdAt);

    // Set time to midnight for comparison
    prevDate.setHours(0, 0, 0, 0);
    currDate.setHours(0, 0, 0, 0);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    if (currDate - prevDate === MS_PER_DAY) {
      dailyStreak += 1;
    } else if (currDate - prevDate > MS_PER_DAY) {
      dailyStreak = 1; // Reset streak if there's a gap of more than one day
    }
  }

  // Update the user's streak in the database
  const user = await prisma.user.findUnique({
    where: { privyId },
    select: { longestStreak: true },
  });

  const newLongestStreak =
    user.longestStreak < dailyStreak ? dailyStreak : user.longestStreak;

  // Update the user's streak and longest streak if necessary
  await prisma.user.update({
    where: { privyId },
    data: {
      streak: dailyStreak,
      longestStreak: newLongestStreak,
    },
  });

  return { ok: true, streak: dailyStreak, longestStreak: newLongestStreak };
}

app.post("/end-session", checkIfValidUser, async (req, res) => {
  try {
    const finishTimestamp = req.body.timestamp;
    const userPrivyId = req.body.user;
    const frontendWrittenTime = req.body.frontendWrittenTime;
    const userWallet = req.body.userWallet;
    const text = req.body.text;
    const result = req.body.result;

    // Validate userPrivyId format and fetch the active session
    if (!isValidPrivyId(userPrivyId)) {
      return res.status(400).send("Invalid user ID.");
    }

    const activeSession = await getActiveSession(userPrivyId);
    if (!activeSession) {
      return res.status(404).send("No active session found.");
    }
    const startingSessionTimestamp = new Date(
      activeSession.startTime
    ).getTime();
    const serverTimeUserWrote = Math.floor(
      (finishTimestamp - startingSessionTimestamp) / 1000
    );
    const delay = Math.abs(serverTimeUserWrote - frontendWrittenTime);
    const sessionDuration = Math.min(serverTimeUserWrote, frontendWrittenTime);
    const isValid = delay < 3000 && sessionDuration > minimumWritingTime;
    if (isValid) {
      const updatedSession = await prisma.writingSession.update({
        where: { id: activeSession.id },
        data: {
          endTime: new Date(),
          text: text,
          result: result,
          sessionDuration: sessionDuration,
        },
      });
      res.status(200).json(updatedSession);
    } else {
      const updatedSession = await prisma.writingSession.update({
        where: { id: activeSession.id },
        data: {
          endTime: new Date(),
          flag: true,
          text: text,
          result: result,
          sessionDuration: sessionDuration,
        },
      });
      res.status(200).json(updatedSession);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while ending the session.");
  }
});

app.post("/save-cid", checkIfValidUser, async (req, res) => {
  const { cid, sessionId, user: userPrivyId, wallet: userWallet } = req.body;
  if (!cid) {
    return res.status(400).send("CID is required.");
  }
  const newenAmount = 7025;
  const ankyMentor = await prisma.ankyMentors.findFirst({
    where: { owner: userWallet },
    orderBy: {
      mentorIndex: "asc",
    },
  });
  try {
    // First, perform critical updates in a transaction
    const result = await prisma.$transaction(async (prisma) => {
      const session = await prisma.writingSession.findUniqueOrThrow({
        where: { id: sessionId, userId: userPrivyId },
      });

      const [transaction, sessionUpdate] = await Promise.all([
        prisma.newenTransaction.create({
          data: {
            userId: userPrivyId,
            amount: newenAmount,
            type: "earned",
            mentorIndex: ankyMentor.mentorIndex,
          },
        }),
        prisma.writingSession.update({
          where: { id: sessionId },
          data: {
            writingCID: cid,
            status: "completed",
            newenEarned: newenAmount,
          },
        }),
      ]);

      return { transaction, sessionUpdate };
    });

    // Then, perform non-critical updates outside the transaction
    const [userUpdate, mentorUpdate] = await Promise.all([
      prisma.user.update({
        where: { privyId: userPrivyId },
        data: {
          newenBalance: { increment: newenAmount },
          totalNewenEarned: { increment: newenAmount },
          wroteToday: true,
          todayCid: cid,
        },
      }),
      prisma.ankyMentors.update({
        where: { id: ankyMentor.id },
        data: { wroteToday: true },
      }),
    ]);

    // Assume updateStreak now accepts Prisma client and is less critical
    const streakUpdate = await updateStreak(userPrivyId, prisma);

    res.status(200).json({
      message: "The cid was added to the session",
      result: { ...result, userUpdate, mentorUpdate, streakUpdate },
    });
  } catch (error) {
    console.error("There was an error saving the cid", error);
    res.status(500).send("There was an error saving the cid");
  }
});

function isValidPrivyId(privyId) {
  return true;
}

async function hasActiveSession(userId) {
  const activeSession = await prisma.writingSession.findFirst({
    where: { userId: userId, status: "active" },
  });
  return !!activeSession;
}

async function getActiveSession(userId) {
  return await prisma.writingSession.findFirst({
    where: { userId: userId, status: "active" },
  });
}

// ********* FINISHED ***********

app.listen(port, () => {
  console.log(`anky server is listening on port ${port}`);
});
