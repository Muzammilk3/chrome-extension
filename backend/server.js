// Simple Productivity Tracker Backend Server
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS configuration
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? ['chrome-extension://*'] 
    : ['http://localhost:3000', 'chrome-extension://*'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Productivity Tracker Backend API is running!',
    version: '1.0.0',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Simple API endpoints for extension
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Placeholder endpoints for extension functionality
app.post('/api/tracking/record', (req, res) => {
  // Simple tracking data endpoint (no database needed)
  const { domain, timeSpent, timestamp } = req.body;
  
  res.json({
    success: true,
    message: 'Tracking data received',
    data: {
      domain,
      timeSpent,
      timestamp: timestamp || new Date().toISOString(),
      recorded: true
    }
  });
});

app.get('/api/reports/daily', (req, res) => {
  // Simple daily report endpoint
  res.json({
    success: true,
    report: {
      date: new Date().toISOString().split('T')[0],
      totalTime: 0,
      domains: [],
      message: 'No data available (local storage only)'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📊 Productivity Tracker Backend API: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`📝 API Status: http://localhost:${PORT}/api/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
