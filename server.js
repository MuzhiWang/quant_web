const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Proxy endpoints - Forward requests to Python FastAPI backend
app.get('/api/*', async (req, res) => {
  try {
    const apiPath = req.path.replace('/api', '');
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${API_BASE_URL}${apiPath}${queryString ? '?' + queryString : ''}`;
    
    console.log(`[Proxy] ${req.method} ${url}`);
    
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('[Proxy Error]', error.message);
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || 'Failed to connect to backend API'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'QMT Trading Dashboard',
    timestamp: new Date().toISOString(),
    backend: API_BASE_URL,
    nodeVersion: process.version
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 QMT Trading Dashboard - Node.js Server');
  console.log('='.repeat(60));
  console.log(`📡 Server:      http://localhost:${PORT}`);
  console.log(`🔌 Backend API: ${API_BASE_URL}`);
  console.log(`📊 Health:      http://localhost:${PORT}/health`);
  console.log(`🔧 Node:        ${process.version}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('✅ Server is ready! Open http://localhost:3000 in your browser.');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});