const { axios } = require("axios");
const prisma = require("./prismaClient");

async function fetchContentFromIrys(cid) {
  const response = await axios.get(`https://gateway.irys.xyz/${cid}`);

  if (!response) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const usable = await response.data;
  return usable;
}

const fetchAllWritings = async () => {
  try {
    let longString = "";

    const answers = await prisma.writingSession.findMany({
      where: {
        ankyverseDay: 8,
      },
    });

    for (let answer of answers) {
      let text;
      if (answer.writingCID) {
        text = await fetchContentFromIrys(answer.writingCID);
      } else {
        text = answer.text;
      }
      longString += `<${text}>\n\n`;
    }
  } catch (error) {
    console.log("there was an error", error);
  }
};

fetchAllWritings();

const fetchWritingsForWink = async (wink) => {
  const startingTimestamp = 1711861200; // Starting timestamp for the third cycle
  const winkDurationInSeconds = 86400; // Duration of a wink in seconds

  // Calculate the start and end timestamp for the given wink
  const winkStartTimestamp =
    startingTimestamp + (wink - 1) * winkDurationInSeconds;
  const winkEndTimestamp = winkStartTimestamp + winkDurationInSeconds;
  try {
    let longString = "";

    const startTime = new Date(winkStartTimestamp * 1000);
    const endTime = new Date(winkEndTimestamp * 1000);

    const writingSessionsForThisWink = await prisma.writingSession.findMany({
      where: {
        startTime: {
          gte: startTime,
          lt: endTime,
        },
      },
    });

    for (let writingSession of writingSessionsForThisWink) {
      let text;
      if (writingSession.writingCID) {
        text = await fetchContentFromIrys(writingSession.writingCID);
      } else {
        text = writingSession.text;
      }
      if (text?.length > 0) {
        longString += `<${text}>\n\n`;
      }
    }

    return longString;
  } catch (error) {
    console.log(
      `there was an error retrieving the writings of wink #${wink} from the third sojourn`,
      error
    );
    return null;
  }
};

const calculateStatsForResonanceWave = async () => {
  let totalWords = 0;
  let sessionCount = 0;
  const walletSessions = {}; // To track the number of sessions per wallet

  for (let wink = 1; wink <= 8; wink++) {
    const writings = await fetchWritingsForWink(wink);
    writings.forEach((writingSession) => {
      const words = writingSession.text
        ? writingSession.text.split(/\s+/).length
        : 0;
      totalWords += words;
      sessionCount++;

      if (walletSessions[writingSession.walletAddress]) {
        walletSessions[writingSession.walletAddress]++;
      } else {
        walletSessions[writingSession.walletAddress] = 1;
      }
    });
  }

  const uniqueWallets = Object.keys(walletSessions).length;
  const walletsThatCameBack = Object.values(walletSessions).filter(
    (count) => count > 1
  ).length;
  const averageSessionsPerWallet = sessionCount / uniqueWallets;
  const engagementRate = (walletsThatCameBack / uniqueWallets) * 100; // in percentage

  return {
    totalWords,
    uniqueWallets,
    walletsThatCameBack,
    averageSessionsPerWallet,
    engagementRate,
  };
};

module.exports = { fetchWritingsForWink, calculateStatsForResonanceWave };
