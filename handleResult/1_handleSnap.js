const { saveFile } = require("../saveFile.js");
const { readJSONfile } = require("../readJSONfile.js");
const { flattenObject } = require("./flattenObject.js");
const { compareObjects } = require("./PareObject.js");
const { compareObjs } = require("./compareOb.js");
const { Parser } = require("json2csv");


const message = readJSONfile("./result/CXA.json");
const startData = readJSONfile("./handleResult/3_startData.json");
const endData = readJSONfile("./handleResult/4_endData.json");

const convertTrades = (data) => {
    const newTrades = {};
    // Kiểm tra nếu trades là object
    if (data && typeof data === 'object') {
        // Chuyển đổi từ mảng sang object với key là số thứ tự
        Object.entries(data).forEach(([tradeId, trade], index) => {
            // Tạo object mới không có field id
            const { id, ...tradeWithoutId } = trade;
            newTrades[index] = tradeWithoutId;
        });
    }

    return newTrades; // Gán lại trades đã chuyển đổi

};

function updateCBOE(startData, message, endData) {
    const expected = {
        exchange: startData.exchange,
        symbol: startData.symbol,
        depth: {
            ask: {},
            bid: {},
            total_ask_size: 0,
            total_bid_size: 0,
        },
        trades: {},
    };

    const startDepth = startData.depth || { ask: {}, bid: {} };
    const messageDepth = message.depth || { ask: {}, bid: {} };
    const trade_price = endData.quote?.trade_price;
    console.log("trade_price", trade_price);

    let depth = expected.depth;

    const sides = ["ask", "bid"];

    sides.forEach((side) => {
        const allPrices = {};

        // Gộp dữ liệu từ cả hai sàn
        [startDepth, messageDepth].forEach((sourceData, index) => {
            const source = "CXA";
            const data = sourceData[side];

            for (const key in data) {
                const { price, quantity, number_of_trades, timestamp } = data[key];
                const parsedPrice = parseFloat(price);

                // Điều kiện lọc giá
                const isValidPrice =
                    (side === "ask" && parsedPrice >= trade_price) ||
                    (side === "bid" && parsedPrice <= trade_price);

                if (isValidPrice) {
                    if (!allPrices[parsedPrice]) {
                        allPrices[parsedPrice] = {
                            symbol: startData.symbol,
                            exchange: "CXA",
                            side: side.charAt(0).toUpperCase() + side.slice(1),
                            quantity: quantity,
                            number_of_trades: number_of_trades || undefined,
                            price: parsedPrice,
                            source: source,
                            timestamp: timestamp,
                        };
                    } else {
                        // Nếu giá đã tồn tại, cộng dồn quantity và cập nhật source
                        allPrices[parsedPrice].quantity += quantity;
                        if (number_of_trades) {
                            // Initialize to 0 if undefined
                            if (allPrices[parsedPrice].number_of_trades === undefined) {
                                allPrices[parsedPrice].number_of_trades = 0;
                            }
                            allPrices[parsedPrice].number_of_trades += number_of_trades;
                        }
                        allPrices[parsedPrice].timestamp = Math.max(allPrices[parsedPrice].timestamp, timestamp);
                    }
                }
            }
        });

        // Sắp xếp và chọn top 10
        const sortedPrices = Object.values(allPrices).sort((a, b) => {
            return side === "ask" ? a.price - b.price : b.price - a.price;
        });

        sortedPrices.slice(0, 10).forEach((item, index) => {
            depth[side][index] = item;
        });

        if (side === "ask") {
            depth.total_ask_size = sortedPrices
                .slice(0, 10) // Cắt lấy 10 phần tử đầu tiên
                .reduce((sum, item) => sum + (item.quantity || 0), 0);
        } else if (side === "bid") {
            depth.total_bid_size = sortedPrices
                .slice(0, 10) // Cắt lấy 10 phần tử đầu tiên
                .reduce((sum, item) => sum + (item.quantity || 0), 0);
        }
    });

    const startTrades = startData.trades ? Object.entries(startData.trades).map(([tradeId, trade]) => {
        return { ...trade, source: "CXA" };
    }) : [];
    const messageTrades = message.trades ? Object.entries(message.trades).map(([tradeId, trade]) => {
        return { ...trade, source: "CXA" };
    }) : [];

    const allTrades = [
        ...startTrades,
        ...messageTrades,
    ];

    // Sắp xếp theo thời gian mới nhất trước, chuẩn hóa time ngay trong lúc so sánh
    allTrades.sort((a, b) => {
        const timeA = a.time < 1e10 ? a.time * 1000 : a.time;
        const timeB = b.time < 1e10 ? b.time * 1000 : b.time;
        return timeB - timeA;
    });


    // Lấy 50 lệnh mới nhất
    const latestTrades = allTrades.slice(0, 50);

    // Chuyển đổi lại về object 
    expected.trades = latestTrades.reduce((acc, trade, index) => {
        // Loại bỏ field id bằng destructuring
        const { id, ...tradeWithoutId } = trade;
        acc[index] = tradeWithoutId;
        return acc;
    }, {});

    return expected;
}

const expectData = updateCBOE(startData, message, endData);
// console.log(JSON.stringify(expectData, null, 2));
saveFile(JSON.stringify(expectData, null, 2), `./handleResult/5_expectData.json`);

const expectDepthFlat = flattenObject(expectData.depth);
const endDepthFlat = flattenObject(endData.depth);
const resultDepth = compareObjects(endDepthFlat, expectDepthFlat);
const contentDepth = new Parser().parse(resultDepth);
saveFile(contentDepth, "./handleResult/reportDepth.csv");

endData.trades = convertTrades(endData.trades);

compareObjs(expectData.trades, endData.trades);
