require("dotenv").config();
const cors = require("cors");
const express = require("express");
const prisma = require("./lib/prismaClient");
const { PrivyClient } = require("@privy-io/server-auth");
const cron = require("node-cron");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");
const moment = require("moment");
const { getAnkyverseDay } = require("./lib/ankyverse");
const mentorsAbi = require("./lib/mentorsAbi.json");

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

const minimumWritingTime = 10;

const startingTimestamp = 1711861200; // Example starting point timestamp
// const startDate = moment.unix(startingTimestamp);

// const cronExpression = startDate.minute() + " " + startDate.hour() + " * * *";
// console.log(`Cron expression: ${cronExpression}`);

// schedule(cronExpression, async () => {
//   console.log("Resetting wroteToday for all users");
//   try {
//     await prisma.user.updateMany({
//       data: {
//         wroteToday: false,
//         todayCid: ''
//       },
//     });
//     console.log("Successfully reset wroteToday for all users");
//   } catch (error) {
//     console.error("Error resetting wroteToday for users:", error);
//   }
// });

function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function getMentorOwners() {
  const ankyverseDay = getAnkyverseDay(new Date());
  const mentorOwners = [];
  for (let tokenId = 1; tokenId <= 192; tokenId++) {
    try {
      const owner = await mentorsContract.ownerOf(tokenId);
      console.log(`Token ID ${tokenId} is owned by ${owner}`);
      const response = await prisma.ankyMentors.create({
        data: {
          mentorIndex: tokenId,
          owner: owner,
          ankyverseDay: ankyverseDay.wink,
        },
      });
      delay(111);
      mentorOwners.push(owner);
    } catch (error) {
      console.error(`Error fetching owner for token ID ${tokenId}: ${error}`);
    }
  }
  console.log(
    `all the owners of mentors for day ${ankyverseDay.wink} are: `,
    mentorOwners
  );
}

getMentorOwners();

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
    const authToken = req.headers.authorization.replace("Bearer ", "");

    try {
      const verifiedClaims = await privy.verifyAuthToken(authToken);

      console.log("the verified claims is: ", verifiedClaims);
      console.log("the user id is: ", verifiedClaims.userId);
      // CHECK AGAINST THE PRIVY ID OF THE USER THAT IS TRYING TO DO THIS.
      next();
    } catch (error) {
      console.log(`token verification failed with error ${error}.`);
      res.status(401).json({ message: "you are not allowed here" });
    }
  } catch (error) {
    console.log("The user is not authorized");
    res.status(401).json({ message: "Not authorized" }); // Sending 401 for unauthorized requests
  }
};

// ********* ROUTES ***********

app.get("/", (req, res) => {
  res.send("hello world");
});

app.post("/user/:privyId", checkIfValidUser, async (req, res) => {
  try {
    let user;
    const privyId = req.params.privyId;
    const walletAddress = req.body.walletAddress;
    const mentor = await prisma.ankyMentors.findOne({
      where: { owner: walletAddress },
    });
    user = await prisma.user.findUnique({
      where: { privyId },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          privyId: privyId,
          walletAddress: walletAddress,
        },
      });
    }
    console.log("IN HERE, THE USER IS: ", user);
    res.json({ user, mentor });
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

    let user = await prisma.newUser.findUnique({
      where: { privyId },
    });

    if (!user) {
      // If not, create a new user
      user = await prisma.newUser.create({
        data: {
          privyId,
        },
      });
    } else {
      // If yes, update the last login time
      user = await prisma.newUser.update({
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
    console.log("starting the session", req.body);
    const userPrivyId = req.body.userPrivyId;
    const now = req.body.timestamp;
    const randomUUID = req.body.randomUUID;
    // Validate the userPrivyId format and check for an existing active session
    if (!isValidPrivyId(userPrivyId)) {
      console.log("aloja");
      return res.status(400).send("Invalid request.");
    }

    const newSession = await prisma.writingSession.create({
      data: {
        userId: userPrivyId,
        startTime: now,
        status: "active",
        randomUUID: randomUUID,
      },
    });
    console.log("the new session is: ", newSession);

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
  console.log("the newen records for this user are: ", newenRecords);

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
    console.log("inside the end session route", req.body);
    const finishTimestamp = req.body.timestamp;
    const userPrivyId = req.body.user;
    const frontendWrittenTime = req.body.frontendWrittenTime;

    // Validate userPrivyId format and fetch the active session
    if (!isValidPrivyId(userPrivyId)) {
      return res.status(400).send("Invalid user ID.");
    }

    const activeSession = await getActiveSession(userPrivyId);
    console.log("the active session is: ", activeSession);
    if (!activeSession) {
      return res.status(404).send("No active session found.");
    }
    const startingSessionTimestamp = new Date(
      activeSession.startTime
    ).getTime();
    console.log("HEEEER", startingSessionTimestamp);
    const serverTimeUserWrote = Math.floor(
      (finishTimestamp - startingSessionTimestamp) / 1000
    );
    console.log("the server time the user wrote is", serverTimeUserWrote);
    const delay = Math.abs(serverTimeUserWrote - frontendWrittenTime);
    const isValid =
      delay < 3000 &&
      Math.min(serverTimeUserWrote, frontendWrittenTime) > minimumWritingTime;
    if (isValid) {
      console.log("IS VALID!");
      let newenAmount = 7025;
      const transaction = await prisma.$transaction([
        prisma.newenTransaction.create({
          data: {
            userId: userPrivyId,
            amount: newenAmount,
            type: "earned",
          },
        }),
        prisma.user.update({
          where: { privyId: userPrivyId },
          data: {
            newenBalance: {
              increment: newenAmount,
            },
            totalNewenEarned: {
              increment: newenAmount,
            },
          },
        }),
      ]);
      const updatedSession = await prisma.writingSession.update({
        where: { id: activeSession.id },
        data: {
          endTime: new Date(),
          status: "completed",
          newenEarned: 7025,
        },
      });
      const userStreak = await updateStreak(userPrivyId);

      updatedSession.streakInfo = userStreak;
      console.log("the updated session is: ", updatedSession);

      res.status(200).json(updatedSession);
    } else {
      const updatedSession = await prisma.writingSession.update({
        where: { id: activeSession.id },
        data: {
          endTime: new Date(),
          status: "completed",
          flag: true,
          newenEarned: 7025,
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
  try {
    const cid = req.body.cid;
    const sessionId = req.body.sessionId;
    const userPrivyId = req.body.user;
    if (cid) {
      const updatedSession = await prisma.writingSession.update({
        where: { id: sessionId, userId: userPrivyId },
        data: {
          writingCID: cid,
          status: "completed",
        },
      });
      const updatedUser = await prisma.user.update({
        where: { privyId: userPrivyId },
        data: {
          wroteToday: true,
          todayCid: cid,
        },
      });
      console.log("the updated session is: ", updatedSession);
      return res.status(200).send("The cid was added to the session");
    }
  } catch (error) {
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
