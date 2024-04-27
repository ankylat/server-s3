const axios = require("axios");
const prisma = require("./prismaClient");
const { Query } = require("@irys/query");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

async function fetchContentFromIrys(cid) {
  const response = await axios.get(`https://gateway.irys.xyz/${cid}`);

  if (!response) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const usable = await response.data;
  return usable;
}

async function getCommunityWritingsForWink(wink) {
  let longText = "";
  const myQuery = new Query({ url: "https://node2.irys.xyz/graphql" });
  const results = await myQuery
    .search("irys:transactions")
    .tags([
      { name: "Content-Type", values: ["text/plain"] },
      { name: "application-id", values: ["Anky Third Sojourn - v0"] },

      {
        name: "sojourn",
        values: ["3"],
      },
      {
        name: "day",
        values: [wink.toString()],
      },
    ])
    .sort("DESC")
    .limit(100);
  const allUserWritings = await Promise.all(
    results.map(async (result, index) => {
      const content = await fetch(`https://node2.irys.xyz/${result.id}`);
      const thisText = await content.text();
      longText += `${thisText}\n\n***\n\n`;
      return {
        cid: result.id,
        timestamp: result.timestamp,
        text: thisText,
        writingContainerType: result?.tags[2]?.value || undefined,
      };
    })
  );
  console.log("all user writings", longText);
  return allUserWritings;
}

async function getCommunitySessionsForWink(wink) {
  let longText = "";
  const myQuery = new Query({ url: "https://node2.irys.xyz/graphql" });
  const results = await myQuery
    .search("irys:transactions")
    .tags([
      { name: "Content-Type", values: ["text/plain"] },
      { name: "application-id", values: ["Anky Third Sojourn - v0"] },

      {
        name: "sojourn",
        values: ["3"],
      },
      {
        name: "day",
        values: [wink.toString()],
      },
    ])
    .sort("DESC")
    .limit(100);
  const allUserWritings = await Promise.all(
    results.map(async (result, index) => {
      const content = await fetch(`https://node2.irys.xyz/${result.id}`);
      const thisText = await content.text();
      longText += `${thisText}\n\n***\n\n`;
      results[index].text = thisText;
      return {
        cid: result.id,
        timestamp: result.timestamp,
        text: thisText,
        address: result.address,
        writingContainerType: result?.tags[2]?.value || undefined,
      };
    })
  );
  return allUserWritings;
}

const fetchAllWritingsByWink = async (wink) => {
  try {
    let longString = "";

    const answers = await prisma.writingSession.findMany({
      where: {
        ankyverseDay: wink,
      },
    });

    for (let answer of answers) {
      let text;
      if (answer.writingCID) {
        text = await fetchContentFromIrys(answer.writingCID);
      } else {
        text = answer.text;
      }
      if (text && text.length > 100) {
        longString += `<${text}>\n\n`;
      }
    }
    return longString;
  } catch (error) {
    console.log("there was an error", error);
  }
};

const fetchWritingsByAddress = async (address) => {
  try {
    console.log("fetching the writings for ", address);
    let longString = "";

    const answers = await prisma.writingSession.findMany({
      where: {
        walletAddress: address,
      },
      orderBy: {
        startTime: "asc", // Change to 'desc' for descending order
      },
    });

    for (let answer of answers) {
      let text;
      if (answer.writingCID) {
        text = await fetchContentFromIrys(answer.writingCID);
      } else {
        text = answer.text;
      }
      answer.finalText = text;
      console.log("*************************");
      console.log(answer);
    }
    return;
  } catch (error) {
    console.log("there was an error", error);
  }
};

const fetchWritingsForWink = async (wink) => {
  const startingTimestamp = 1711861200; // Starting timestamp for the third cycle
  const winkDurationInSeconds = 86400; // Duration of a wink in seconds

  // Calculate the start and end timestamp for the given wink
  const winkStartTimestamp =
    startingTimestamp + (wink - 1) * winkDurationInSeconds;
  const winkEndTimestamp = winkStartTimestamp + winkDurationInSeconds;
  try {
    let longString = "";
    let writings = [];

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
    for (let session of writingSessionsForThisWink) {
      let text;
      if (session.writingCID) {
        text = await fetchContentFromIrys(session.writingCID);
      } else {
        text = session.text;
      }
      if (text?.length > 100) {
        longString += `${text}\n\n***\n\n`;
        writings.push(text.replace(/\+/g, ""));
      }
    }
    return writings;
  } catch (error) {
    console.log(
      `there was an error retrieving the writings of wink #${wink} from the third sojourn`,
      error
    );
    return [];
  }
};

const fetchWritingSessionsForWink = async (wink) => {
  const startingTimestamp = 1711861200; // Starting timestamp for the third cycle
  const winkDurationInSeconds = 86400; // Duration of a wink in seconds

  // Calculate the start and end timestamp for the given wink
  const winkStartTimestamp =
    startingTimestamp + (wink - 1) * winkDurationInSeconds;
  const winkEndTimestamp = winkStartTimestamp + winkDurationInSeconds;
  try {
    let longString = "";
    let writings = [];

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
    for (let session of writingSessionsForThisWink) {
      let text;
      if (session.writingCID) {
        text = await fetchContentFromIrys(session.writingCID);
        session.text = text;
      } else {
        text = session.text;
      }
      if (text?.length > 100) {
        longString += `${text}\n\n***\n\n`;
        writings.push(text.replace(/\+/g, ""));
      }
      session.address = session.walletAddress;
    }
    return writingSessionsForThisWink;
  } catch (error) {
    console.log(
      `there was an error retrieving the writings of wink #${wink} from the third sojourn`,
      error
    );
    return [];
  }
};

// fetchWritingsForWink(24);
getCommunityWritingsForWink(27);
// getAllTheWrittenText();

async function getAllTheWrittenText() {
  try {
    let longestString = "";
    let thisString;
    for (let i = 9; i < 17; i++) {
      thisString = await fetchWritingsForWink(i);
      longestString += thisString;
    }
    // longestString.replace(" ", "");
    // longestString.replace("\n", "");
    // console.log(longestString);
    return longestString;
  } catch (error) {
    console.log("there was an error here", error);
  }
}

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

// const processFirstResonanceWave = async () => {
//   try {
//     let allSessions = [];
//     for (let i = 1; i < 25; i++) {
//       const firstWritings = await fetchWritingSessionsForWink(i);
//       const secondWritings = await getCommunitySessionsForWink(i);
//       allSessions = [...allSessions, ...firstWritings, ...secondWritings];
//     }

//     const addressMap = {};

//     // Correction: Use 'for...of' to handle async operations correctly.
//     for (const session of allSessions) {
//       // Normalize the address
//       if (!session.address) {
//         const thisUser = await prisma.user.findUnique({
//           where: { privyId: session.userId },
//         });
//         if (thisUser) {
//           session.address = thisUser.walletAddress;
//         }
//       }

//       const normalizedAddress = session?.address?.toLowerCase().trim();
//       if (normalizedAddress) {
//         const date = new Date(session.startTime || session.timestamp)
//           .toISOString()
//           .split("T")[0];

//         if (!addressMap[normalizedAddress]) {
//           addressMap[normalizedAddress] = new Set(); // Use a set to store unique days
//         }
//         // Add the date to the set of unique days for this address
//         addressMap[normalizedAddress].add(date);
//       }
//     }

//     // Prepare records for CSV output
//     const records = Object.keys(addressMap).map((address) => {
//       return {
//         tokenAddress: "0xffe3CDC92F24988Be4f6F8c926758dcE490fe77E",
//         chainId: "8453",
//         receiverAddress: address,
//         value: 168552000000000000000000,
//       };
//     });

//     // CSV Writer setup
//     const csvWriter = createCsvWriter({
//       path: "final_first_newen_airdrop.csv",
//       header: [
//         { id: "tokenAddress", title: "tokenAddress" },
//         { id: "chainId", title: "chainId" },
//         { id: "receiverAddress", title: "receiverAddress" },
//         { id: "value", title: "value" },
//       ],
//       fieldDelimiter: ";",
//     });

//     // Write to CSV
//     await csvWriter.writeRecords(records);
//     console.log("The CSV file was written successfully");
//   } catch (error) {
//     console.error("Error during processing:", error);
//   }
// };
// processFirstResonanceWave();

module.exports = {
  fetchWritingsForWink,
  fetchAllWritingsByWink,
  calculateStatsForResonanceWave,
  fetchContentFromIrys,
  getAllTheWrittenText,
};
