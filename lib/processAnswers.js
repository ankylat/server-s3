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
        status: "completed",
        writingCID: {
          not: null,
        },
      },
    });
    for (let answer of answers) {
      const text = await fetchContentFromIrys(answer.writingCID);
      longString += `<${text}>\n\n`;
    }
    console.log("the answers are: ", longString);
  } catch (error) {
    console.log("there was an error", error);
  }
};

fetchAllWritings();
