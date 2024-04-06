const { default: axios } = require("axios");
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

    // Get the current date in UTC
    const now = new Date();
    const currentUtcTime = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds()
    );
    const currentDate = new Date(currentUtcTime);

    // Subtract the necessary hours to get to 5 AM UTC
    currentDate.setUTCHours(5);
    currentDate.setUTCMinutes(0);
    currentDate.setUTCSeconds(0);
    currentDate.setUTCMilliseconds(0);

    // If it's already past 5 AM, subtract a day to get the previous day's date
    if (now.getUTCHours() >= 5) {
      currentDate.setUTCDate(currentDate.getUTCDate());
    }

    const answers = await prisma.writingSession.findMany({
      where: {
        ankyverseDay: 6,
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

    console.log("the answers are: ", longString);
  } catch (error) {
    console.log("there was an error", error);
  }
};

fetchAllWritings();
