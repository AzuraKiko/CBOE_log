const { saveFile } = require("./saveFile.js");
const { readJSONfile } = require("./readJSONfile.js");

const totalData = readJSONfile("./grouped_by_symbol_ALL_20250425_023706.json");


// Helper function to update depth levels
const updateDepthLevel = (depthObj, price, quantityDiff, isAdd, timestamp, symbol) => {
  const level = depthObj[price] || {
    symbol,
    quantity: 0,
    number_of_trades: 0,
    price,
    exchange: "CXA",
    timestamp: 0,
    source: "CXA"
  };

  level.quantity += quantityDiff;
  level.number_of_trades = level.number_of_trades + (isAdd === true ? 1 : (isAdd === false ? -1 : 0));
  level.timestamp = Math.max(level.timestamp, timestamp);

  // if (level.number_of_trades <= 0 || level.quantity <= 0) {
  //   delete depthObj[price];
  //   return false;
  // }

  depthObj[price] = level;
  return true;
};

const getDepth = (data, tradePrice = 0, timeRange = null, topN = 10) => {
  if (!data || typeof data !== 'object') return {
    symbol: "",
    exchange: "CXA",
    depth: { ask: {}, bid: {}, total_ask_size: 0, total_bid_size: 0 },
    trades: {}
  };

  const firstSymbol = Object.keys(data)[0]; // Get first symbol or default to BHP

  const depth = {
    ask: {},
    bid: {},
    total_ask_size: 0,
    total_bid_size: 0,
    courseOfSales: []
  };

  // Convert time range strings to timestamps if provided
  // const startTime = timeRange && timeRange.start ? new Date(timeRange.start).getTime() : null;
  // const endTime = timeRange && timeRange.end ? new Date(timeRange.end).getTime() : null;
  const startTime = timeRange && timeRange.start ? Number(timeRange.start) : null;
  const endTime = timeRange && timeRange.end ? Number(timeRange.end) : null;

  // Track all orders with their current state
  const orderState = new Map();
  const allOrders = new Map();

  for (const symbol in data) {
    for (const orderId in data[symbol]) {
      const messages = data[symbol][orderId];
      for (const message of messages) {
        if (!message || !message.parsed_message) continue;

        if (message.message_type === 'AddOrderMessage') {
          // Always process add orders to build complete reference map
          allOrders.set(message.parsed_message.OrderID, {
            price: parseFloat(message.parsed_message.Price),
            side: message.parsed_message.SideIndicator,
            quantity: parseInt(message.parsed_message.Quantity),
            timestamp: Number(message.parsed_message.Timestamp) // Store the timestamp
          });
        }
      }
    }
  }

  // Process each symbol in the data
  for (const symbol in data) {
    // Process each order ID
    const symbolData = data[symbol];
    for (const orderId in symbolData) {
      const messages = symbolData[orderId]
        .filter(m => m?.parsed_message)
        .sort((a, b) => a.parsed_message.Timestamp - b.parsed_message.Timestamp);

      // Skip duplicate messages (keep only the first occurrence of each message)
      const processedSequences = new Set();

      for (const message of messages) {
        if (!message || !message.parsed_message) continue;
        const { parsed_message: pm, message_type } = message;
        const messageTime = Number(pm.Timestamp);

        // Apply time filter if provided
        if (timeRange) {
          // Skip messages outside the time range
          if ((startTime && messageTime < startTime) ||
            (endTime && messageTime > endTime)) {
            continue;
          }
        }

        // Skip duplicated messages based on sequence number
        if (processedSequences.has(pm.HdrSequence)) continue;
        processedSequences.add(pm.HdrSequence);


        const price = parseFloat(pm.Price);
        const quantity = parseInt(pm.Quantity || pm.ExecutedQty, 10);
        const side = pm.SideIndicator;

        // Handle different message types
        switch (message_type) {
          case "AddOrderMessage": {
            // Store order state
            orderState.set(orderId, { side, price, quantity, symbol: pm.Symbol, timestamp: messageTime });
            const target = side === "S" ? depth.ask : depth.bid;
            const totalKey = side === "S" ? "total_ask_size" : "total_bid_size";
            if (updateDepthLevel(target, price, quantity, true, messageTime, pm.Symbol)) {
              depth[totalKey] += quantity;
            }
            break;
          }

          case "ModifyOrderMessage": {
            const order = orderState.get(orderId) || allOrders.get(orderId);
            const orderTime = order.timestamp;
            // if (!order) continue;

            const target = order.side === "S" ? depth.ask : depth.bid;
            const totalKey = order.side === "S" ? "total_ask_size" : "total_bid_size";

            updateDepthLevel(target, order.price, -order.quantity, false, orderTime, pm.Symbol);
            depth[totalKey] = depth[totalKey] - order.quantity;

            if (updateDepthLevel(target, price, quantity, true, messageTime, pm.Symbol)) {
              depth[totalKey] += quantity;
            }

            if (order) {
              order.price = price;
              order.quantity = quantity;
            } else {
              orderState.set(orderId, {
                price,
                quantity,
                side,
                symbol: pm.Symbol,
                timestamp: messageTime
              })
            }
            break;
          }

          case "DeleteOrderMessage":
          case "OrderExecutedMessage": {
            const order = orderState.get(orderId) || allOrders.get(orderId);
            // if (!order) continue;

            const target = order.side === "S" ? depth.ask : depth.bid;
            const totalKey = order.side === "S" ? "total_ask_size" : "total_bid_size";
            const qty = message_type === "OrderExecutedMessage" ? quantity : order.quantity;

            if (message_type === "OrderExecutedMessage" && order.quantity !== quantity) {
              updateDepthLevel(target, order.price, -qty, 0, messageTime, pm.Symbol);
            } else {
              updateDepthLevel(target, order.price, -qty, false, messageTime, pm.Symbol);
            }

            depth[totalKey] = depth[totalKey] - qty;

            if (message_type === "DeleteOrderMessage") {
              if (!order) {
                orderState.set(orderId, {
                  price,
                  quantity: -qty,
                  side,
                  symbol: pm.Symbol,
                  timestamp: messageTime
                })
              } else {
                orderState.delete(orderId);
              }
            } else if (message_type === "OrderExecutedMessage") {
              if (!order) {
                orderState.set(orderId, {
                  price,
                  quantity: -qty,
                  side,
                  symbol: pm.Symbol,
                  timestamp: messageTime
                })
              } else {
                order.quantity = order.quantity - qty;
              }
              // order.quantity = order.quantity - qty;
              // if (order.quantity <= 0) orderState.delete(orderId);

              // Add to course of sales
              depth.courseOfSales.unshift({
                price,
                quantity: qty,
                time: Number(pm.Timestamp) / 1000,
                source: "CXA"
              });
            }

            break;
          }
        }
      }
    }
  }

  // Format ask and bid objects with numeric indices
  const askObj = {};

  Object.values(depth.ask)
    .filter(level => tradePrice <= 0 || level.price >= tradePrice)
    .sort((a, b) => a.price - b.price)
    .slice(0, topN)
    .forEach((level, index) => {
      askObj[index] = { ...level, side: 'Ask' };
    });

  const bidObj = {};
  Object.values(depth.bid)
    .filter(level => tradePrice <= 0 || level.price <= tradePrice)
    .sort((a, b) => b.price - a.price)
    .slice(0, topN)
    .forEach((level, index) => {
      bidObj[index] = { ...level, side: 'Bid' };
    });

  // Format trades object with numeric indices
  const tradesObj = {};
  depth.courseOfSales
    .sort((a, b) => b.time - a.time)
    .slice(0, 50)
    .forEach((trade, index) => {
      tradesObj[index] = trade;
    });

  return {
    symbol: firstSymbol,
    exchange: "CXA",
    depth: {
      ask: askObj,
      bid: bidObj,
      total_ask_size: depth.total_ask_size,
      total_bid_size: depth.total_bid_size
    },
    trades: tradesObj
  };
};


const getOrderDataByPrice = (data, targetPrice, timeRange = null) => {
  if (!data || isNaN(targetPrice)) return {};

  targetPrice = parseFloat(targetPrice);
  const result = {};
  const startTime = timeRange?.start ? Number(timeRange.start) : null;
  const endTime = timeRange?.end ? Number(timeRange.end) : null;

  for (const symbol in data) {
    const symbolData = data[symbol];

    for (const orderId in symbolData) {
      const messages = symbolData[orderId]
        .filter(m => m?.parsed_message)
        .sort((a, b) => a.parsed_message.Timestamp - b.parsed_message.Timestamp);

      const processedSequences = new Set();
      const filteredMessages = [];
      let hasMatchingPriceInTimeRange = false;
      let currentQuantity = null;
      let currentSide = null;

      // First pass: check if any message matches criteria
      for (const message of messages) {
        const { parsed_message: pm } = message;
        if (!pm) continue;

        const timestamp = Number(pm.Timestamp);
        const price = parseFloat(pm.Price);

        // Check if this message is within time range and has matching price
        const isInTimeRange = (!startTime || timestamp >= startTime) &&
          (!endTime || timestamp <= endTime);

        if (isInTimeRange && price === targetPrice) {
          hasMatchingPriceInTimeRange = true;
          break; // Found at least one matching message, no need to continue checking
        }
      }

      // If we found a matching message, process all messages for this order
      if (hasMatchingPriceInTimeRange) {
        for (const message of messages) {
          const { parsed_message: pm, message_type } = message;
          if (!pm) continue;

          if (processedSequences.has(pm.HdrSequence)) continue;
          processedSequences.add(pm.HdrSequence);

          // if (message_type === "AddOrderMessage") {
          //   currentQuantity = pm.Quantity;
          //   currentSide = pm.SideIndicator;
          // }

          const quantity = message_type === "DeleteOrderMessage" ? pm.Quantity :
            message_type === "OrderExecutedMessage" ? pm.ExecutedQty :
              pm.Quantity;

          filteredMessages.push({
            OrderID: orderId,
            Symbol: pm.Symbol || symbol,
            Price: pm.Price || "N/A",
            // Quantity: quantity || currentQuantity || "N/A",
            Quantity: quantity || "N/A",
            // SideIndicator: message_type === "AddOrderMessage" ? pm.SideIndicator : currentSide || "N/A",
            SideIndicator: pm.SideIndicator || "N/A",
            Timestamp: pm.Timestamp || message.time,
            message_type
          });
        }

        result[orderId] = filteredMessages;
      }
    }
  }

  return result;
};


// Usage
const startData = readJSONfile("./handleResult/3_startData.json");
const endData = readJSONfile("./handleResult/4_endData.json");
const currentTradePrice = 64.28;
const tradePrice = endData.quote?.trade_price ?? currentTradePrice;


const timeRange = {
  start: Number((startData.quote.updated) - 110) * 1000, // Start time (inclusive)
  end: Number((endData.quote.updated) + 110) * 1000    // End time (inclusive)
};
// // console.log("timeRange", timeRange);
// const time = {
//   start: new Date(timeRange.start / 1000).toISOString(),
//   end: new Date(timeRange.end / 1000).toISOString(),
// };
// console.log("timeRange", time);

// console.log(new Date(1745466894433000 / 1000).toISOString());
// const timeRange = null;

const resultWithoutTimeFilter = getDepth(totalData, tradePrice, timeRange);
saveFile(JSON.stringify(resultWithoutTimeFilter, null, 2), "./result/depthCXA.json");

const targetPrice = 64.39;
const resultPrice = getOrderDataByPrice(totalData, targetPrice, timeRange);
saveFile(JSON.stringify(resultPrice, null, 2), `./result/priceCXA_${targetPrice}.json`);