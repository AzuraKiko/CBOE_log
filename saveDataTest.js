const { saveFile } = require("./saveFile.js");
const { readJSONfile } = require("./readJSONfile.js");

const dataTest = "SnapShot"
let startData = {};
let endData = {};

if (dataTest === "SnapShot") {
    startData = readJSONfile("./result/snap_1745467622731.json")[0];
    endData = readJSONfile("./result/snap_1745467683246.json")[0];
} else if (dataTest === "RealTime") {
    startData = readJSONfile("./result/realtime_1744167842417.json")[0].data;
    endData = readJSONfile("./result/realtime_1744167842417.json")[1].data;
}

saveFile(JSON.stringify(startData, null, 2), "./handleResult/3_startData.json");
saveFile(JSON.stringify(endData, null, 2), "./handleResult/4_endData.json");
