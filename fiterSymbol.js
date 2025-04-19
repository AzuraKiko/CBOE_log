const { readJSONfile } = require("./readJSONfile.js");
const { saveFile } = require("./saveFile.js");
const totalData = readJSONfile("./grouped_by_symbol_20250415_013445.json");

const data = totalData.BHP;
saveFile(JSON.stringify(data, null, 2), "./groupBHP.json");
