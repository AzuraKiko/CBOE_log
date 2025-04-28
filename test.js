const { saveFile } = require("./saveFile.js");
const { readJSONfile } = require("./readJSONfile.js");

const startData = readJSONfile("./handleResult/3_startData.json");
const endData = readJSONfile("./handleResult/4_endData.json");

function updateCBOE(startData, endData) {
    const startDepth = startData.depth || { ask: {}, bid: {} };
    const endDepth = endData.depth || { ask: {}, bid: {} };

    let depth = { ask: {}, bid: {} };
    const sides = ["ask", "bid"];

    sides.forEach((side) => {
        const allPrices = {};

        // First, add all prices from endData
        for (const key in endDepth[side]) {
            const { price, quantity, number_of_trades, timestamp } = endDepth[side][key];
            const parsedPrice = parseFloat(price);

            allPrices[parsedPrice] = {
                symbol: endData.symbol,
                exchange: "CXA",
                side: side.charAt(0).toUpperCase() + side.slice(1),
                quantity: quantity,
                number_of_trades: number_of_trades || 0,
                price: parsedPrice,
                source: "CXA",
                timestamp: timestamp,
            };
        }

        // Then, process startData - subtract quantities for matching prices
        for (const key in startDepth[side]) {
            const { price, quantity, number_of_trades } = startDepth[side][key];
            const parsedPrice = parseFloat(price);

            if (allPrices[parsedPrice]) {
                // Subtract quantity and number_of_trades
                allPrices[parsedPrice].quantity -= quantity;

                if (number_of_trades && allPrices[parsedPrice].number_of_trades) {
                    allPrices[parsedPrice].number_of_trades -= number_of_trades;
                }

                // If quantity becomes zero or negative, remove this price level
                if (allPrices[parsedPrice].quantity <= 0) {
                    delete allPrices[parsedPrice];
                }
            } else {
                // If price exists only in startData, add it with negative values
                allPrices[parsedPrice] = {
                    symbol: startData.symbol,
                    exchange: "CXA",
                    side: side.charAt(0).toUpperCase() + side.slice(1),
                    quantity: -quantity,
                    number_of_trades: number_of_trades ? -number_of_trades : 0,
                    price: parsedPrice,
                    source: "CXA",
                    timestamp: startDepth[side][key].timestamp,
                };
            }
        }

        // // Sắp xếp và chọn top 10
        // const sortedPrices = Object.values(allPrices)
        //     .filter(item => item.quantity > 0) // Only keep positive quantities
        //     .sort((a, b) => {
        //         return side === "ask" ? a.price - b.price : b.price - a.price;
        //     });

        // sortedPrices.slice(0, 10).forEach((item, index) => {
        //     depth[side][index] = item;
        // });

        // Calculate totals
        // if (side === "ask") {
        //     depth.total_ask_size = sortedPrices
        //         .slice(0, 10)
        //         .reduce((sum, item) => sum + (item.quantity || 0), 0);
        // } else if (side === "bid") {
        //     depth.total_bid_size = sortedPrices
        //         .slice(0, 10)
        //         .reduce((sum, item) => sum + (item.quantity || 0), 0);
        // }
    });

    return depth;
}

const result = updateCBOE(startData, endData);
console.log(result);
saveFile(JSON.stringify(result, null, 2), `./handleResult/CBOE.json`);
