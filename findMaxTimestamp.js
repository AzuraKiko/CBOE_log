const { readJSONfile } = require("./readJSONfile");

function findMaxTimestamp(depthData) {
    let maxTimestamp = 0;

    // Duyệt qua tất cả các mức Ask
    for (const key in depthData.ask) {
        const timestamp = depthData.ask[key].timestamp;
        if (timestamp > maxTimestamp) {
            maxTimestamp = timestamp;
        }
    }

    // Duyệt qua tất cả các mức Bid
    for (const key in depthData.bid) {
        const timestamp = depthData.bid[key].timestamp;
        if (timestamp > maxTimestamp) {
            maxTimestamp = timestamp;
        }
    }

    return maxTimestamp;
}

// Dữ liệu đầu vào (đã được cung cấp)
const depthData = readJSONfile("./handleResult/3_startData.json").depth;

// Gọi hàm và in kết quả
const maxTimestamp = findMaxTimestamp(depthData);
console.log("Max timestamp trong depth:", maxTimestamp);