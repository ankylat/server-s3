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

    const answers = await prisma.writingSession.findMany({
      where: {
        ankyverseDay: 7,
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
