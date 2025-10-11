# QMT Trading Web Dashboard

A React-based web dashboard for visualizing and analyzing QMT quantitative trading system data.

## Features

- **Strategy Overview**: Real-time portfolio value, cash balance, holdings, and positions
- **Performance Analytics**: Comprehensive metrics including PNL, returns, Sharpe ratio, and drawdown
- **Date Range Filtering**: Filter all data (transactions, performance, PNL, holdings) by custom date ranges
- **Transaction History**: View and filter trade executions with date range support and color-coded actions (green for BUY, red for SELL)
- **Holdings History**: View daily holdings grouped by date with position counts and total values
- **Interactive Charts**: Visual representation of portfolio value trends and daily returns
- **Dry Run Support**: Toggle between live and dry run trading data
- **Graceful Error Handling**: Toast notifications for non-critical errors allow continued use of the UI
- **Resilient Data Loading**: Individual API failures don't block the entire dashboard

## Prerequisites

- Python FastAPI backend server running on `http://localhost:8000` (see `quant/joinquant/strategy/realtime_trading/trading_component/qmt_trading/server/`)
- Node.js (v22.20.0 or later recommended)

## Node Installation

1. Download nvm from https://github.com/coreybutler/nvm-windows/releases
2. Add system variable:
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Users\Administrator\AppData\Local\nvm", "Machine")
   ```
3. Install LTS:
   ```bash
   nvm install lts
   nvm use 22.20.0
   ```

## Installation

```bash
# Install dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

## Running the Application

1. **Start the Python backend server** (in a separate terminal):
   ```bash
   cd quant/joinquant/strategy/realtime_trading/trading_component/qmt_trading/server
   python start_server.py
   ```

2. **Start the Node.js proxy server**:
   ```bash
   npm start
   ```

3. **Open your browser** to `http://localhost:3000`

## Using Date Range Filters

The dashboard includes date range pickers in the header that allow you to:
- Filter transactions by date range
- View performance metrics for specific time periods
- Analyze daily PNL for custom date ranges

### How It Works

1. **Select Date Range**: Choose start and/or end dates using the date pickers
2. **Click Refresh**: Click the "Refresh" button to load data for the selected date range
3. **View Filtered Data**: All data (transactions, performance, PnL) will update to reflect your date range

**Important**: Date changes do NOT automatically trigger data fetching. You must click the "Refresh" button to apply your date range selection. This gives you control over when to fetch data and prevents unnecessary API calls.

**Note**: Transactions are limited to 200 records. Use date range filters to narrow down results for better performance.

## API Endpoints Used

The dashboard connects to the following backend API endpoints:

- `GET /api/strategies` - List available strategies
- `GET /api/strategy/{strategy_name}/summary` - Portfolio summary
- `GET /api/strategy/{strategy_name}/performance` - Performance metrics with date range
- `GET /api/strategy/{strategy_name}/transactions` - Transactions with date range filtering
- `GET /api/strategy/{strategy_name}/holdings` - Holdings history grouped by date with date range
- `GET /api/strategy/{strategy_name}/daily-pnl` - Daily PNL with date range

## Technology Stack

- **Frontend**: React.js with Recharts for data visualization
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend Proxy**: Express.js (Node.js)
- **Data Source**: Python FastAPI backend

## Development

The application runs with live reload enabled. Any changes to the React code will automatically refresh the browser.

## Error Handling

The dashboard uses a two-tier error handling approach:

### Critical Errors (Full-Page Error Screen)
- **Backend Connection Failure**: Shown when the backend API is unreachable during initial load
- **No Strategies Available**: Displayed when no trading strategies are found in the database

These errors prevent the entire page from loading since the application cannot function without this core data.

### Non-Critical Errors (Toast Notifications)
- **Individual API Failures**: If one data source fails (e.g., transactions), the rest of the dashboard remains functional
- **Auto-Dismiss**: Toasts automatically disappear after 5 seconds
- **Manual Dismiss**: Click the X icon to close any toast immediately
- **Multiple Toasts**: Multiple errors can be displayed simultaneously

**Example**: If the transactions API fails but summary and performance data load successfully, you'll see:
- ✅ Portfolio summary displays normally
- ✅ Performance metrics show correctly
- ❌ Toast notification: "Failed to load transactions. Please try again."
- ✅ You can continue using other parts of the dashboard

This approach ensures maximum availability - the UI remains usable even when some backend services have issues.

## Troubleshooting

### Backend Connection Issues
If you see "Cannot connect to backend API" errors:
- Ensure the Python FastAPI server is running on port 8000
- Check that the backend API is accessible at `http://localhost:8000/api/health`
- Verify database connectivity in the backend

### Toast Notification Errors
If you see toast notifications about failed data loads:
- Click the "Refresh" button to retry loading the data
- Check the browser console (F12) for detailed error messages
- Verify the date range you selected contains data
- Individual failures don't affect other data - continue using available features

### No Data Displayed
- Make sure you have run some trading strategies with dry run mode enabled
- Check the browser console for detailed error messages
- Verify the selected date range includes data

## License

Part of the QMT Trading System