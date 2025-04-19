const { readJSONfile } = require("./readJSONfile.js");

const jsonData = readJSONfile("./result/priceAnalysis34.32.json");

function calculateTradesBySide(data) {
    // Initialize counters for each side
    const result = {
      B: { numberOfTrades: 0, totalQuantity: 0 },
      S: { numberOfTrades: 0, totalQuantity: 0 }
    };
    
    // Track orders by ID to handle executions correctly
    const orderQuantities = {};
    
    // Process all activities for each order
    for (const orderId in data.activities) {
      const activities = data.activities[orderId];
      
      for (const activity of activities) {
        const side = activity.side; // 'B' for Buy, 'S' for Sell
        
        if (!result[side]) {
          console.warn(`Unknown side: ${side}`);
          continue;
        }
        
        switch (activity.activityType) {
          case 'add':
            result[side].numberOfTrades += 1;
            result[side].totalQuantity += activity.quantity;
            // Store the original quantity for this order
            orderQuantities[orderId] = activity.quantity;
            break;
            
          case 'delete':
            result[side].numberOfTrades -= 1;
            result[side].totalQuantity -= activity.quantity;
            break;
            
          case 'modify':
            result[side].numberOfTrades += 1;
            result[side].totalQuantity += activity.quantity;
            // Update the order quantity
            orderQuantities[orderId] = activity.quantity;
            break;
            
          case 'execute':
            result[side].totalQuantity -= activity.quantity;
            // If execution quantity equals the original add quantity, decrement trade count
            if (orderQuantities[orderId] === activity.quantity) {
              result[side].numberOfTrades -= 1;
              // Reset the tracked quantity since the order is fully executed
              orderQuantities[orderId] = 0;
            } else if (orderQuantities[orderId] > activity.quantity) {
              // Partial execution - reduce the tracked quantity
              orderQuantities[orderId] -= activity.quantity;
            }
            break;
        }
      }
    }
    
    return result;
  }
  
  // Parse and process the data
  const result = calculateTradesBySide(jsonData);
  
  // Display results for Buy side (B)
  console.log("Buy (B) side:");
  console.log("  Number of trades:", result.B.numberOfTrades);
  console.log("  Total quantity:", result.B.totalQuantity);
  
  // Display results for Sell side (S)
  console.log("Sell (S) side:");
  console.log("  Number of trades:", result.S.numberOfTrades);
  console.log("  Total quantity:", result.S.totalQuantity);
  