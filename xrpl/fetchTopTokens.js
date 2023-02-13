// https://api.xrpl.to/api/tokens?start=0&limit=100
const fs = require("fs");
const fetch = require("node-fetch");
// import fetch from "node-fetch";

async function fetchDataAndSaveToFile(url, filePath) {
  let response = await fetch(url);
  const responseToJson = await response.json();
  console.log(responseToJson.tokens.length);
  let tokenIds = [];
  responseToJson.tokens.forEach((e, i) => {
    tokenIds.push([e.name, e.currency]);
    console.log(e.name);
  });
  const data = await JSON.stringify(tokenIds);

  fs.writeFile(filePath, data, (err) => {
    if (err) throw err;
    console.log(`Data was saved to ${filePath}`);
  });
}

fetchDataAndSaveToFile(
  "https://api.xrpl.to/api/tokens?start=0&limit=100",
  "tokens.txt"
);
