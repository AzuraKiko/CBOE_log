const { saveFile } = require("./saveFile.js");
const { readJSONfile } = require("./readJSONfile.js");

const totalData = readJSONfile("./grouped_by_symbol_BHP_20250416_181532.json");

class MarketDataProcessor {
    constructor() {
        this.bidBook = new Map();  // Map<price, {quantity, number_of_trades}>
        this.askBook = new Map();  // Map<price, {quantity, number_of_trades}>
        this.courseOfSales = [];   // Array of executed trades
        this.orderReferences = new Map(); // Map<orderId, {price, side, quantity}>
        this.allOrders = new Map(); // Map<orderId, {price, side, quantity}>
        this.priceActivityLog = new Map(); // To track order activities at each price level
    }

    processMessages(data, timeRange) {
        const startTime = timeRange && timeRange.start ? Number(timeRange.start) : null;
        const endTime = timeRange && timeRange.end ? Number(timeRange.end) : null;

        // First pass: Process all AddOrderMessages to build complete order references
        // regardless of time range
        for (const symbol in data) {
            for (const orderId in data[symbol]) {
                const messages = data[symbol][orderId];
                for (const message of messages) {
                    if (!message || !message.parsed_message) continue;

                    if (message.message_type === 'AddOrderMessage') {
                        // Always process add orders to build complete reference map
                        this.allOrders.set(message.parsed_message.OrderID, {
                            price: parseFloat(message.parsed_message.Price),
                            side: message.parsed_message.SideIndicator,
                            quantity: parseInt(message.parsed_message.Quantity),
                            timestamp: Number(message.parsed_message.Timestamp) // Store the timestamp
                        });
                    }
                }
            }
        }


        // Second pass: Process all messages with time filtering
        for (const symbol in data) {
            for (const orderId in data[symbol]) {
                const messages = data[symbol][orderId];
                for (const message of messages) {
                    if (!message || !message.parsed_message) continue;


                    const messageTime = Number(message.parsed_message.Timestamp);

                    // Apply time filter if provided
                    if (timeRange) {
                        // Skip messages outside the time range
                        if ((startTime && messageTime < startTime) ||
                            (endTime && messageTime > endTime)) {
                            continue;
                        }
                    };

                    switch (message.message_type) {
                        case 'AddOrderMessage':
                            this.handleAddOrder(message.parsed_message);
                            this.logPriceActivity(message.parsed_message.Price, 'add', message.parsed_message);
                            break;
                        case 'ModifyOrderMessage':
                            // Get old price before modifying order
                            const modifyOrderId = message.parsed_message.OrderID;
                            if (this.orderReferences.has(modifyOrderId)) {
                                // Copy side information to the message if missing
                                if (!message.parsed_message.SideIndicator) {
                                    message.parsed_message.SideIndicator = this.orderReferences.get(modifyOrderId).side;
                                }
                            } else {
                                if (!message.parsed_message.SideIndicator) {
                                    message.parsed_message.SideIndicator = this.allOrders.get(modifyOrderId)?.side;
                                }
                            }

                            // Handle the modify order message
                            this.handleModifyOrder(message.parsed_message);
                            this.logPriceActivity(message.parsed_message.Price, 'modify', message.parsed_message);
                            break;
                        case 'DeleteOrderMessage':
                            // Get price before handling delete (which will remove the reference)
                            const deleteOrderId = message.parsed_message.OrderID;
                            let priceBeforeDelete = null;
                            if (this.orderReferences.has(deleteOrderId)) {

                                priceBeforeDelete = this.orderReferences.get(deleteOrderId).price;

                                // Copy side information to the message if missing
                                if (!message.parsed_message.SideIndicator) {
                                    message.parsed_message.SideIndicator = this.orderReferences.get(deleteOrderId).side;
                                }

                                // Copy quantity information to the message if missing
                                if (!message.parsed_message.Quantity) {
                                    message.parsed_message.Quantity = this.orderReferences.get(deleteOrderId).quantity;
                                }

                            } else {
                                priceBeforeDelete = this.allOrders.get(deleteOrderId)?.price;
                                if (!message.parsed_message.SideIndicator) {
                                    message.parsed_message.SideIndicator = this.allOrders.get(deleteOrderId)?.side;
                                }
                                // Copy quantity information to the message if missing
                                if (!message.parsed_message.Quantity) {
                                    message.parsed_message.Quantity = this.allOrders.get(deleteOrderId)?.quantity;
                                }
                            }
                            // Handle the delete order message
                            this.handleDeleteOrder(message.parsed_message);
                            // Log the price activity after handling the delete
                            if (priceBeforeDelete !== null) {
                                this.logPriceActivity(priceBeforeDelete, 'delete', message.parsed_message);
                            }
                            break;
                        case 'OrderExecutedMessage':
                            // Get price before handling execution (which might remove the reference if fully executed)
                            const executeOrderId = message.parsed_message.OrderID;
                            let priceBeforeExecute = null;
                            let sideBeforeExecute = null;

                            if (this.orderReferences.has(executeOrderId)) {
                                const ref = this.orderReferences.get(executeOrderId);
                                priceBeforeExecute = ref.price;
                                sideBeforeExecute = ref.side;

                                // Add price and side to the message if missing
                                if (!message.parsed_message.Price) {
                                    message.parsed_message.Price = priceBeforeExecute;
                                }
                                if (!message.parsed_message.SideIndicator) {
                                    message.parsed_message.SideIndicator = sideBeforeExecute;
                                }
                                // Add execution price to the message for logging
                                message.parsed_message._executionPrice = priceBeforeExecute;
                            } else {
                                priceBeforeExecute = this.allOrders.get(executeOrderId)?.price;
                                sideBeforeExecute = this.allOrders.get(executeOrderId)?.side;
                                // Add price and side to the message if missing
                                if (!message.parsed_message.Price) {
                                    message.parsed_message.Price = priceBeforeExecute;
                                }
                                if (!message.parsed_message.SideIndicator) {
                                    message.parsed_message.SideIndicator = sideBeforeExecute;
                                }
                                // Add execution price to the message for logging
                                message.parsed_message._executionPrice = priceBeforeExecute;
                            }

                            // Handle the order executed message
                            this.handleOrderExecuted(message.parsed_message);

                            // Log the price activity after handling the execution
                            // Use the execution price that we stored
                            if (message.parsed_message._executionPrice !== undefined) {
                                this.logPriceActivity(message.parsed_message._executionPrice, 'execute', message.parsed_message);
                            } else if (priceBeforeExecute !== null) {
                                this.logPriceActivity(priceBeforeExecute, 'execute', message.parsed_message);
                            } else if (message.parsed_message.Price) {
                                // If no stored price reference, use the one from the message
                                this.logPriceActivity(message.parsed_message.Price, 'execute', message.parsed_message);
                            }
                            break;
                    }
                };
            }
        }
    }

    logPriceActivity(price, activityType, message) {
        price = parseFloat(price);
        if (!this.priceActivityLog.has(price)) {
            this.priceActivityLog.set(price, []);
        }

        // Get side information from order reference if available
        let side = message.SideIndicator;
        if (!side && message.OrderID && this.orderReferences.has(message.OrderID)) {
            side = this.orderReferences.get(message.OrderID).side;
        }

        // Get quantity information from order reference if available
        let quantity = message.Quantity;
        if (!quantity && message.OrderID && this.orderReferences.has(message.OrderID)) {
            quantity = this.orderReferences.get(message.OrderID).quantity;
        }

        const activity = {
            type: activityType,
            timestamp: Number(message.Timestamp),
            message: { ...message },
            orderId: message.OrderID, // Store OrderID explicitly for tracking
            side: side,
            quantity: quantity || message.ExecutedQty ? parseInt(message.ExecutedQty) : null,
        };

        this.priceActivityLog.get(price).push(activity);
    }

    getOrderDataByPrice(targetPrice, timeRange = null) {
        targetPrice = parseFloat(targetPrice);
        const startTime = timeRange && timeRange.start ? Number(timeRange.start) : null;
        const endTime = timeRange && timeRange.end ? Number(timeRange.end) : null;

        // Get activities at the target price
        const activities = this.priceActivityLog.get(targetPrice) || [];

        // Filter by time range if provided
        const filteredActivities = timeRange
            ? activities.filter(activity => {
                return (!startTime || activity.timestamp >= startTime) &&
                    (!endTime || activity.timestamp <= endTime);
            })
            : activities;

        // Analyze the activities
        const summary = {
            price: targetPrice,
            activities: {},
        };

        // if (filteredActivities.length > 0) {
        //     // Sort by timestamp
        //     filteredActivities.sort((a, b) => a.timestamp - b.timestamp);

        //     // Analyze each activity
        //     for (const activity of filteredActivities) {
        //         const orderID = activity.message.OrderID;
        //         const order = {
        //             activityType: activity.type,
        //             side: activity.message.SideIndicator || activity.side,
        //             quantity: parseInt(activity.message.Quantity) || activity.quantity,
        //             price: parseFloat(activity.message.Price),
        //             Timestamp: activity.message.Timestamp,
        //         };

        //         // Initialize array for this orderID if it doesn't exist
        //         if (!summary.activities[orderID]) {
        //             summary.activities[orderID] = [];
        //         }

        //         // Add the order to the array for this orderID
        //         summary.activities[orderID].push(order);
        //     }
        // }

        if (filteredActivities.length > 0) {
            // Sort by timestamp
            filteredActivities.sort((a, b) => a.timestamp - b.timestamp);

            // First, collect all activities by orderID
            const orderActivities = new Map();
            for (const activity of filteredActivities) {
                const orderID = activity.message.OrderID;
                if (!orderActivities.has(orderID)) {
                    orderActivities.set(orderID, []);
                }
                orderActivities.get(orderID).push(activity);
            }

            // Process each orderID
            for (const [orderID, orderActivitiesList] of orderActivities.entries()) {
                // Check if the final price for this order is the target price
                const finalOrderPrice = this.orderReferences.has(orderID)
                    ? this.orderReferences.get(orderID).price
                    : (this.allOrders.has(orderID) ? this.allOrders.get(orderID).price : null);

                const isFinalPriceForOrder = parseFloat(finalOrderPrice) === targetPrice;

                // If the final price is not the target price, skip this order entirely
                if (!isFinalPriceForOrder) {
                    continue;
                }

                // Find all modify activities for this order at this price
                const modifyActivitiesAtThisPrice = orderActivitiesList.filter(a => a.type === 'modify');

                // Get the last modify activity at this price (if any)
                const lastModifyAtThisPrice = modifyActivitiesAtThisPrice.length > 0 ?
                    modifyActivitiesAtThisPrice[modifyActivitiesAtThisPrice.length - 1] : null;

                // Initialize array for this orderID
                summary.activities[orderID] = [];

                // Process each activity for this orderID
                for (const activity of orderActivitiesList) {
                    const order = {
                        activityType: activity.type,
                        side: activity.message.SideIndicator || activity.side,
                        quantity: parseInt(activity.message.Quantity) || activity.quantity,
                        price: parseFloat(activity.message.Price),
                        Timestamp: activity.message.Timestamp,
                    };

                    if (activity.type === 'modify') {
                        // Only include if this is the last modify at this price
                        if (activity === lastModifyAtThisPrice) {
                            summary.activities[orderID].push(order);
                        }
                    } else if (activity.type === 'add') {
                        // For add activities, check if there were any subsequent modify activities
                        // that changed the price away from targetPrice

                        // Get all activities for this order from all price levels
                        const allOrderActivities = [];
                        for (const price of this.priceActivityLog.keys()) {
                            const priceActivities = this.priceActivityLog.get(price);
                            const orderActivitiesAtPrice = priceActivities.filter(a =>
                                a.orderId === orderID &&
                                (!timeRange ||
                                    (!startTime || a.timestamp >= startTime) &&
                                    (!endTime || a.timestamp <= endTime)
                                )
                            );
                            allOrderActivities.push(...orderActivitiesAtPrice);
                        }

                        // Sort by timestamp
                        allOrderActivities.sort((a, b) => a.timestamp - b.timestamp);

                        // Find the index of the current add activity
                        const currentActivityIndex = allOrderActivities.findIndex(a =>
                            a.timestamp === activity.timestamp && a.type === activity.type);

                        if (currentActivityIndex !== -1) {
                            // Check if there are any modify activities after this add that changed the price
                            // away from targetPrice
                            let wasModifiedAway = false;
                            let wasModifiedBack = false;

                            for (let i = currentActivityIndex + 1; i < allOrderActivities.length; i++) {
                                const nextActivity = allOrderActivities[i];
                                if (nextActivity.type === 'modify') {
                                    const modifyPrice = parseFloat(nextActivity.message.Price);
                                    if (modifyPrice !== targetPrice) {
                                        wasModifiedAway = true;
                                    } else if (wasModifiedAway) {
                                        // If it was modified away and then back to targetPrice
                                        wasModifiedBack = true;
                                    }
                                }
                            }

                            // Only include the add if it was never modified away from targetPrice
                            // or if it was modified away but later modified back to targetPrice
                            if (!wasModifiedAway || wasModifiedBack) {
                                summary.activities[orderID].push(order);
                            }
                        } else {
                            // If we can't find the activity in the full list (shouldn't happen),
                            // include it by default
                            summary.activities[orderID].push(order);
                        }
                    } else {
                        // For other activities (delete, execute), include them all
                        summary.activities[orderID].push(order);
                    }
                }

                // If no activities were added for this orderID, remove the empty array
                if (summary.activities[orderID].length === 0) {
                    delete summary.activities[orderID];
                }
            }
        }

        return summary;
    }

    handleAddOrder(message) {
        const price = parseFloat(message.Price);
        const quantity = parseInt(message.Quantity);
        const side = message.SideIndicator;
        const book = side === 'B' ? this.bidBook : this.askBook;

        // Store order reference
        this.orderReferences.set(message.OrderID, {
            price,
            side,
            quantity
        });

        // Update book
        if (book.has(price)) {
            const entry = book.get(price);
            entry.quantity += quantity;
            entry.number_of_trades += 1;
        } else {
            book.set(price, {
                quantity,
                number_of_trades: 1
            });
        }
    }

    handleModifyOrder(message) {
        const newPrice = parseFloat(message.Price);
        const newQuantity = parseInt(message.Quantity);
        const orderId = message.OrderID;

        const ref = this.orderReferences.get(orderId) ?? this.allOrders.get(orderId);
        const oldPrice = ref.price;
        const oldQuantity = ref.quantity;
        const side = ref.side;
        const book = side === 'B' ? this.bidBook : this.askBook;

        // Update existing entry
        if (book.has(oldPrice)) {
            const entry = book.get(oldPrice);

            if (newPrice !== oldPrice) {
                // Price changed, remove from old price
                entry.quantity -= oldQuantity;
                entry.number_of_trades -= 1; // Giảm số lệnh tại mức giá cũ

                // if (entry.quantity <= 0 || entry.number_of_trades <= 0) {
                //     book.delete(oldPrice);
                // }

                // Add to new price
                if (book.has(newPrice)) {
                    const newEntry = book.get(newPrice);
                    newEntry.quantity += newQuantity;
                    newEntry.number_of_trades += 1; // Tăng số lệnh tại mức giá mới
                } else {
                    book.set(newPrice, {
                        quantity: newQuantity,
                        number_of_trades: 1
                    });
                }
            } else {
                // Quantity changed at same price
                entry.quantity = entry.quantity - oldQuantity + newQuantity;
                // number_of_trades không thay đổi vì lệnh vẫn ở cùng mức giá

                // if (entry.quantity <= 0) {
                //     book.delete(oldPrice);
                // }
            }
        } else {
            book.set(oldPrice, {
                quantity: -ref.quantity,
                number_of_trades: -1
            });
            if (book.has(newPrice)) {
                const newEntry = book.get(newPrice);
                newEntry.quantity += newQuantity;
                newEntry.number_of_trades += 1; // Tăng số lệnh tại mức giá mới
            } else {
                book.set(newPrice, {
                    quantity: newQuantity,
                    number_of_trades: 1
                });
            }
        }

        if (!this.orderReferences.has(orderId)) {
            this.orderReferences.set(orderId, {
                price: newPrice,
                quantity: newQuantity,
                side: side
            });
        } else {
            // Update reference
            ref.price = newPrice;
            ref.quantity = newQuantity
        }
    }


    handleDeleteOrder(message) {
        const orderId = message.OrderID;

        const ref = this.orderReferences.get(orderId) ?? this.allOrders.get(orderId);
        const price = ref.price;
        const quantity = ref.quantity;
        const side = ref.side;
        const book = side === 'B' ? this.bidBook : this.askBook;

        if (book.has(price)) {
            const entry = book.get(price);
            entry.quantity -= quantity;
            entry.number_of_trades -= 1;
            // if (entry.quantity <= 0 || entry.number_of_trades <= 0) {
            //     book.delete(price);
            // }
        } else {
            book.set(price, {
                quantity: -quantity,
                number_of_trades: -1
            });
        }

        if (!this.orderReferences.has(orderId)) {
            this.orderReferences.set(orderId, {
                price: price,
                quantity: -quantity,
                side: side
            });
        } else {
            this.orderReferences.delete(orderId);
        }

        // this.orderReferences.delete(orderId);
    }

    handleOrderExecuted(message) {
        const orderId = message.OrderID;

        const ref = this.orderReferences.get(orderId) ?? this.allOrders.get(orderId);
        const price = ref.price;
        const executedQty = parseInt(message.ExecutedQty);
        const side = ref.side;
        const book = side === 'B' ? this.bidBook : this.askBook;

        // Store the execution price for the message
        message._executionPrice = price;

        // Update book
        if (book.has(price)) {
            const entry = book.get(price);
            entry.quantity -= executedQty;
            // Only decrease number_of_trades if this is the full execution
            if (ref.quantity === executedQty) {
                entry.number_of_trades -= 1;
            }
            // if (entry.quantity <= 0 || entry.number_of_trades <= 0) {
            //     book.delete(price);
            // }
        } else {
            book.set(price, {
                quantity: -executedQty,
                number_of_trades: -1
            });
        }

        // Update reference
        // ref.quantity -= executedQty;
        // if (ref.quantity <= 0) {
        //     this.orderReferences.delete(orderId);
        // }

        if (!this.orderReferences.has(orderId)) {
            this.orderReferences.set(orderId, {
                price: price,
                quantity: -executedQty,
                side: side
            });
        } else {
            ref.quantity -= executedQty;
        }
        // Add to course of sales
        this.courseOfSales.unshift({
            price,
            quantity: executedQty,
            time: message.Timestamp
        });
        // Sort the array by time in descending order (newest first)
        this.courseOfSales.sort((a, b) => b.time - a.time);

        // Limit array to 50 items
        if (this.courseOfSales.length > 50) this.courseOfSales.pop();
    }

    getDepth(currentTradePrice) {
        const symbol = Object.keys(totalData)[0]; // Get symbol from the data

        // Helper function to get the latest timestamp for a price
        const getLatestTimestampForPrice = (price, side) => {
            if (this.priceActivityLog.has(price)) {
                const activities = this.priceActivityLog.get(price);
                if (activities && activities.length > 0) {
                    // Filter activities by side first, then get the latest timestamp
                    const sideActivities = activities.filter(activity =>
                        side === 'Bid' ? activity.side === 'B' : activity.side === 'S'
                    );

                    if (sideActivities.length > 0) {
                        return Math.max(...sideActivities.map(activity => activity.timestamp));
                    }
                }
            }
            return Date.now() * 1000; // Default to current time in microseconds if no activity
        };

        // Convert Maps to arrays and sort
        let asks = Array.from(this.askBook.entries())
            .filter(([price]) => price >= currentTradePrice)
            .sort(([a], [b]) => a - b)
            .slice(0, 10)
            .map(([price, data], index) => ({
                symbol: symbol,
                quantity: data.quantity,
                number_of_trades: data.number_of_trades,
                price: price,
                exchange: 'CXA',
                timestamp: getLatestTimestampForPrice(price, 'Ask'), // Pass 'Ask' side
                source: 'CXA',
                side: 'Ask'
            }));

        let bids = Array.from(this.bidBook.entries())
            .filter(([price]) => price <= currentTradePrice)
            .sort(([a], [b]) => b - a)
            .slice(0, 10)
            .map(([price, data], index) => ({
                symbol: symbol,
                quantity: data.quantity,
                number_of_trades: data.number_of_trades,
                price: price,
                exchange: 'CXA',
                timestamp: getLatestTimestampForPrice(price, 'Bid'), // Pass 'Bid' side
                source: 'CXA',
                side: 'Bid'
            }));

        // Calculate total sizes
        const total_ask_size = Array.from(this.askBook.entries())
            .reduce((sum, [_, data]) => sum + data.quantity, 0);

        const total_bid_size = Array.from(this.bidBook.entries())
            .reduce((sum, [_, data]) => sum + data.quantity, 0);


        // Convert arrays to objects with numeric keys
        const ask = {};
        asks.forEach((item, index) => {
            ask[index.toString()] = item;
        });

        const bid = {};
        bids.forEach((item, index) => {
            bid[index.toString()] = item;
        });

        return {
            ask,
            bid,
            total_ask_size,
            total_bid_size
        };
    }

    getCourseOfSales() {
        // Get raw course of sales data
        const rawCourseOfSales = this.courseOfSales.slice(0, 50);
        // Convert array to object with numeric keys
        const trades = {};
        rawCourseOfSales.forEach((trade, index) => {
            trades[index.toString()] = {
                price: trade.price,
                quantity: trade.quantity,
                time: Number(trade.time) / 1000,
                source: "CXA"
            };
        });
        return trades;
    }
}

const startData = readJSONfile("./handleResult/3_startData.json");
const endData = readJSONfile("./handleResult/4_endData.json");
const tradePrice = 34.32;
const currentTradePrice = endData.quote?.trade_price ?? tradePrice;

const timeRange = {
    start: Number(startData.quote.updated) * 1000, // Start time (inclusive)
    end: Number(endData.quote.updated) * 1000    // End time (inclusive)
};
console.log("timeRange", timeRange);

const processor = new MarketDataProcessor();
processor.processMessages(totalData, timeRange);
const depth = processor.getDepth(currentTradePrice);
const courseOfSales = processor.getCourseOfSales();

const targetPrice = 34.32;
// Example of using getOrderDataByPrice
const priceAnalysis = processor.getOrderDataByPrice(targetPrice, timeRange);
// console.log(`Order data at price ${targetPrice}:`, JSON.stringify(priceAnalysis, null, 2));
saveFile(JSON.stringify(priceAnalysis, null, 2), `./result/priceAnalysis${targetPrice}.json`);

// Format output to match API specification
const output = {
    symbol: Object.keys(totalData)[0],
    exchange: "CXA",
    depth: depth,
    trades: courseOfSales,
};

saveFile(JSON.stringify(output, null, 2), "./result/CXA.json");