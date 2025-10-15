/**
 * Win Rate Calculation Utilities
 */

/**
 * Calculate win rate from transaction data using FIFO (First In First Out) method
 * Tracks sequential round trips: each sell is matched with corresponding buys
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} Win rate metrics including winRate, winningTradesCount, losingTradesCount
 */
export const calculateWinRate = (transactions) => {
  if (!transactions || transactions.length === 0) {
    return {
      winRate: 0,
      winningTradesCount: 0,
      losingTradesCount: 0,
      profitLossRatio: 0
    };
  }

  // Sort transactions by date and time to ensure chronological order
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.execution_datetime || a.trade_date);
    const dateB = new Date(b.execution_datetime || b.trade_date);
    return dateA - dateB;
  });

  // Group by stock code and process sequentially
  const stockPositions = {};
  
  sortedTransactions.forEach(tx => {
    const code = tx.code;
    if (!stockPositions[code]) {
      stockPositions[code] = {
        buyQueue: [],  // Queue of buy transactions (FIFO)
        roundTrips: [] // Completed round trips
      };
    }

    const position = stockPositions[code];

    if (tx.action.toLowerCase() === 'buy') {
      // Add to buy queue
      position.buyQueue.push({
        quantity: tx.quantity,
        price: tx.price,
        net_amount: tx.net_amount,
        date: tx.execution_datetime || tx.trade_date
      });
    } else if (tx.action.toLowerCase() === 'sell') {
      // Match with buys using FIFO
      let remainingSellQty = tx.quantity;
      let totalBuyCost = 0;
      let totalSellRevenue = tx.net_amount;

      while (remainingSellQty > 0 && position.buyQueue.length > 0) {
        const oldestBuy = position.buyQueue[0];

        if (oldestBuy.quantity <= remainingSellQty) {
          // Fully consume this buy
          totalBuyCost += oldestBuy.net_amount;
          remainingSellQty -= oldestBuy.quantity;
          position.buyQueue.shift(); // Remove from queue
        } else {
          // Partially consume this buy
          const consumedQty = remainingSellQty;
          const proportionalCost = (consumedQty / oldestBuy.quantity) * oldestBuy.net_amount;
          totalBuyCost += proportionalCost;
          
          // Update remaining quantity in buy
          oldestBuy.quantity -= consumedQty;
          oldestBuy.net_amount -= proportionalCost;
          remainingSellQty = 0;
        }
      }

      // If we matched some buys, record a round trip
      if (totalBuyCost > 0) {
        const pnl = totalSellRevenue - totalBuyCost;
        position.roundTrips.push({
          pnl: pnl,
          isWin: pnl > 0,
          sellDate: tx.execution_datetime || tx.trade_date
        });
      }
    }
  });

  // Count winning and losing round trips
  let winningTrades = 0;
  let losingTrades = 0;

  Object.values(stockPositions).forEach(position => {
    position.roundTrips.forEach(trip => {
      if (trip.isWin) {
        winningTrades++;
      } else {
        losingTrades++;
      }
    });
  });

  const totalRoundTrips = winningTrades + losingTrades;
  const winRate = totalRoundTrips > 0 ? winningTrades / totalRoundTrips : 0;

  // Win/Lose Ratio (count ratio, not amount ratio)
  let profitLossRatio = 0;
  if (losingTrades > 0) {
    profitLossRatio = winningTrades / losingTrades;
  } else if (winningTrades > 0) {
    profitLossRatio = winningTrades; // All wins, no losses
  }

  console.log(`Win Rate Calculation: ${winningTrades} wins / ${losingTrades} losses = ${(winRate * 100).toFixed(1)}% win rate`);

  return {
    winRate,
    winningTradesCount: winningTrades,
    losingTradesCount: losingTrades,
    profitLossRatio
  };
};

