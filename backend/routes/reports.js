const express = require('express');
const { query, validationResult } = require('express-validator');
const Report = require('../models/Report');
const TrackingData = require('../models/TrackingData');

const router = express.Router();

// @route   GET /api/reports/daily
// @desc    Get daily report for a specific date
// @access  Private
router.get('/daily', [
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in ISO format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const date = req.query.date ? new Date(req.query.date) : new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Check if report already exists
    let report = await Report.findOne({
      userId: req.user._id,
      type: 'daily',
      'period.start': startOfDay,
      'period.end': endOfDay,
      status: 'completed'
    });

    if (!report) {
      // Generate new report
      report = await Report.generateDailyReport(req.user._id, date);
    }

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Get daily report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating daily report'
    });
  }
});

// @route   GET /api/reports/weekly
// @desc    Get weekly report
// @access  Private
router.get('/weekly', [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate) : (() => {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      date.setHours(0, 0, 0, 0);
      return date;
    })();

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    endDate.setHours(23, 59, 59, 999);

    // Check if report already exists
    let report = await Report.findOne({
      userId: req.user._id,
      type: 'weekly',
      'period.start': startDate,
      'period.end': endDate,
      status: 'completed'
    });

    if (!report) {
      // Generate new weekly report
      report = await generateWeeklyReport(req.user._id, startDate, endDate);
    }

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Get weekly report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating weekly report'
    });
  }
});

// @route   GET /api/reports/monthly
// @desc    Get monthly report
// @access  Private
router.get('/monthly', [
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  query('year')
    .optional()
    .isInt({ min: 2020, max: 2030 })
    .withMessage('Year must be between 2020 and 2030')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const currentDate = new Date();
    const year = req.query.year ? parseInt(req.query.year) : currentDate.getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : currentDate.getMonth() + 1;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Check if report already exists
    let report = await Report.findOne({
      userId: req.user._id,
      type: 'monthly',
      'period.start': startDate,
      'period.end': endDate,
      status: 'completed'
    });

    if (!report) {
      // Generate new monthly report
      report = await generateMonthlyReport(req.user._id, startDate, endDate);
    }

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Get monthly report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating monthly report'
    });
  }
});

// @route   GET /api/reports/productivity-trend
// @desc    Get productivity trend over time
// @access  Private
router.get('/productivity-trend', [
  query('days')
    .optional()
    .isInt({ min: 7, max: 90 })
    .withMessage('Days must be between 7 and 90')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const days = req.query.days ? parseInt(req.query.days) : 30;
    
    const trendData = await TrackingData.getProductivityTrend(req.user._id, days);

    // Calculate moving average for smoother trend
    const movingAverageWindow = Math.min(7, Math.floor(days / 4));
    const trendWithMA = trendData.map((day, index) => {
      const start = Math.max(0, index - movingAverageWindow + 1);
      const window = trendData.slice(start, index + 1);
      const average = window.reduce((sum, d) => sum + d.productivityScore, 0) / window.length;
      
      return {
        ...day,
        movingAverage: Math.round(average)
      };
    });

    // Calculate overall trends
    const overallMetrics = trendData.reduce((acc, day) => {
      acc.totalTime += day.totalTime;
      acc.totalProductiveTime += day.productiveTime;
      acc.totalDistractingTime += day.distractingTime;
      acc.daysWithData++;
      
      return acc;
    }, {
      totalTime: 0,
      totalProductiveTime: 0,
      totalDistractingTime: 0,
      daysWithData: 0
    });

    const averageProductivityScore = overallMetrics.daysWithData > 0 ?
      Math.round((overallMetrics.totalProductiveTime / overallMetrics.totalTime) * 100) : 0;

    res.json({
      success: true,
      data: {
        period: {
          days,
          start: trendData[0]?.date,
          end: trendData[trendData.length - 1]?.date
        },
        trend: trendWithMA,
        overview: {
          averageProductivityScore,
          totalTime: overallMetrics.totalTime,
          productiveTime: overallMetrics.totalProductiveTime,
          distractingTime: overallMetrics.totalDistractingTime,
          daysWithData: overallMetrics.daysWithData
        }
      }
    });

  } catch (error) {
    console.error('Get productivity trend error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching productivity trend'
    });
  }
});

// @route   GET /api/reports/insights
// @desc    Get personalized insights and recommendations
// @access  Private
router.get('/insights', async (req, res) => {
  try {
    // Get recent data for insights
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const weeklyData = await TrackingData.getProductivityTrend(req.user._id, 7);
    const categoryData = await TrackingData.getCategoryBreakdown(req.user._id, startDate, endDate);

    const insights = generatePersonalizedInsights(weeklyData, categoryData, req.user);

    res.json({
      success: true,
      insights
    });

  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating insights'
    });
  }
});

// @route   GET /api/reports/compare
// @desc    Compare productivity between two periods
// @access  Private
router.get('/compare', [
  query('period1Start')
    .isISO8601()
    .withMessage('Period 1 start date must be in ISO format'),
  query('period1End')
    .isISO8601()
    .withMessage('Period 1 end date must be in ISO format'),
  query('period2Start')
    .optional()
    .isISO8601()
    .withMessage('Period 2 start date must be in ISO format'),
  query('period2End')
    .optional()
    .isISO8601()
    .withMessage('Period 2 end date must be in ISO format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const period1Start = new Date(req.query.period1Start);
    const period1End = new Date(req.query.period1End);
    
    // If period 2 not specified, use the same duration before period 1
    const period1Duration = period1End - period1Start;
    const period2End = req.query.period2End ? 
      new Date(req.query.period2End) : 
      new Date(period1Start.getTime() - 1);
    const period2Start = req.query.period2Start ? 
      new Date(req.query.period2Start) : 
      new Date(period2End.getTime() - period1Duration);

    // Get data for both periods
    const [period1Data, period2Data] = await Promise.all([
      TrackingData.getCategoryBreakdown(req.user._id, period1Start, period1End),
      TrackingData.getCategoryBreakdown(req.user._id, period2Start, period2End)
    ]);

    // Calculate comparison metrics
    const comparison = calculatePeriodComparison(period1Data, period2Data);

    res.json({
      success: true,
      comparison: {
        period1: {
          start: period1Start.toISOString().split('T')[0],
          end: period1End.toISOString().split('T')[0],
          data: period1Data
        },
        period2: {
          start: period2Start.toISOString().split('T')[0],
          end: period2End.toISOString().split('T')[0],
          data: period2Data
        },
        metrics: comparison
      }
    });

  } catch (error) {
    console.error('Compare periods error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while comparing periods'
    });
  }
});

// @route   GET /api/reports/export
// @desc    Export report data in various formats
// @access  Private
router.get('/export', [
  query('type')
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Type must be daily, weekly, or monthly'),
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be json or csv'),
  query('startDate')
    .isISO8601()
    .withMessage('Start date must be in ISO format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { type, format = 'json', startDate } = req.query;
    const endDate = req.query.endDate || new Date().toISOString();

    // Get tracking data for the period
    const trackingData = await TrackingData.find({
      userId: req.user._id,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ date: 1 });

    if (format === 'csv') {
      // Convert to CSV
      const csvData = convertToCSV(trackingData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="productivity-export-${startDate}.csv"`);
      res.send(csvData);
    } else {
      // Return JSON
      res.json({
        success: true,
        data: {
          period: { start: startDate, end: endDate },
          type,
          exportedAt: new Date().toISOString(),
          records: trackingData
        }
      });
    }

  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while exporting report'
    });
  }
});

// Helper function to generate weekly report
async function generateWeeklyReport(userId, startDate, endDate) {
  const report = new Report({
    userId,
    type: 'weekly',
    period: { start: startDate, end: endDate }
  });

  try {
    // Get all tracking data for the week
    const trackingData = await TrackingData.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate metrics
    await report.calculateMetrics(trackingData);

    // Generate daily breakdown
    const dailyBreakdown = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayData = trackingData.filter(item => 
        item.date.toDateString() === d.toDateString()
      );
      
      const dayMetrics = dayData.reduce((acc, item) => {
        acc.totalTime += item.timeSpent;
        if (item.category === 'productive') acc.productiveTime += item.timeSpent;
        if (['distracting', 'social', 'entertainment'].includes(item.category)) {
          acc.distractingTime += item.timeSpent;
        }
        return acc;
      }, { totalTime: 0, productiveTime: 0, distractingTime: 0 });

      dailyBreakdown.push({
        date: new Date(d),
        ...dayMetrics,
        productivityScore: dayMetrics.totalTime > 0 ? 
          Math.round((dayMetrics.productiveTime / dayMetrics.totalTime) * 100) : 0
      });
    }

    report.dailyBreakdown = dailyBreakdown;
    report.generateInsights();
    report.status = 'completed';
    
    await report.save();
    return report;

  } catch (error) {
    report.status = 'failed';
    report.error = { message: error.message, stack: error.stack };
    await report.save();
    throw error;
  }
}

// Helper function to generate monthly report
async function generateMonthlyReport(userId, startDate, endDate) {
  const report = new Report({
    userId,
    type: 'monthly',
    period: { start: startDate, end: endDate }
  });

  try {
    const trackingData = await TrackingData.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    });

    await report.calculateMetrics(trackingData);
    report.generateInsights();
    report.status = 'completed';
    
    await report.save();
    return report;

  } catch (error) {
    report.status = 'failed';
    report.error = { message: error.message, stack: error.stack };
    await report.save();
    throw error;
  }
}

// Helper function to generate personalized insights
function generatePersonalizedInsights(weeklyData, categoryData, user) {
  const insights = [];

  // Calculate averages
  const avgProductivityScore = weeklyData.reduce((sum, day) => sum + day.productivityScore, 0) / weeklyData.length;
  const totalTime = categoryData.reduce((sum, cat) => sum + cat.totalTime, 0);
  const productiveTime = categoryData.find(cat => cat._id === 'productive')?.totalTime || 0;
  const distractingTime = categoryData.filter(cat => 
    ['distracting', 'social', 'entertainment'].includes(cat._id)
  ).reduce((sum, cat) => sum + cat.totalTime, 0);

  // Productivity insights
  if (avgProductivityScore >= 80) {
    insights.push({
      type: 'achievement',
      title: 'Productivity Champion!',
      description: `Your average productivity score this week is ${Math.round(avgProductivityScore)}%. You're doing excellent!`,
      severity: 'low',
      actionable: false
    });
  } else if (avgProductivityScore < 50) {
    insights.push({
      type: 'improvement',
      title: 'Focus Opportunity',
      description: `Your productivity score is ${Math.round(avgProductivityScore)}%. Try using focus mode more often to improve.`,
      severity: 'medium',
      actionable: true,
      action: 'Start a focus session'
    });
  }

  // Time distribution insights
  const distractingPercentage = totalTime > 0 ? (distractingTime / totalTime) * 100 : 0;
  if (distractingPercentage > 30) {
    insights.push({
      type: 'warning',
      title: 'High Distraction Time',
      description: `${Math.round(distractingPercentage)}% of your time was spent on distracting sites. Consider blocking more sites or using focus mode.`,
      severity: 'high',
      actionable: true,
      action: 'Review blocked sites'
    });
  }

  // Trend insights
  if (weeklyData.length >= 2) {
    const recentScore = weeklyData[weeklyData.length - 1].productivityScore;
    const previousScore = weeklyData[weeklyData.length - 2].productivityScore;
    const improvement = recentScore - previousScore;

    if (improvement > 10) {
      insights.push({
        type: 'achievement',
        title: 'Improving Trend!',
        description: `Your productivity improved by ${improvement} points yesterday. Keep up the momentum!`,
        severity: 'low'
      });
    } else if (improvement < -10) {
      insights.push({
        type: 'tip',
        title: 'Get Back on Track',
        description: `Your productivity dipped by ${Math.abs(improvement)} points yesterday. Consider what changed and adjust accordingly.`,
        severity: 'medium'
      });
    }
  }

  // User-specific insights
  if (user.stats.totalFocusSessions === 0) {
    insights.push({
      type: 'tip',
      title: 'Try Focus Mode',
      description: 'You haven\'t used focus mode yet. It\'s a great way to boost productivity and reduce distractions.',
      severity: 'low',
      actionable: true,
      action: 'Start your first focus session'
    });
  }

  return insights;
}

// Helper function to calculate period comparison
function calculatePeriodComparison(period1Data, period2Data) {
  const period1Total = period1Data.reduce((sum, cat) => sum + cat.totalTime, 0);
  const period2Total = period2Data.reduce((sum, cat) => sum + cat.totalTime, 0);

  const period1Productive = period1Data.find(cat => cat._id === 'productive')?.totalTime || 0;
  const period2Productive = period2Data.find(cat => cat._id === 'productive')?.totalTime || 0;

  const period1Score = period1Total > 0 ? (period1Productive / period1Total) * 100 : 0;
  const period2Score = period2Total > 0 ? (period2Productive / period2Total) * 100 : 0;

  return {
    totalTimeChange: calculatePercentageChange(period2Total, period1Total),
    productivityScoreChange: calculatePercentageChange(period2Score, period1Score),
    productiveTimeChange: calculatePercentageChange(period2Productive, period1Productive),
    trend: period1Score > period2Score ? 'improving' : period1Score < period2Score ? 'declining' : 'stable'
  };
}

// Helper function to calculate percentage change
function calculatePercentageChange(oldValue, newValue) {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return Math.round(((newValue - oldValue) / oldValue) * 100);
}

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = [
    'Date', 'Domain', 'Time Spent (ms)', 'Visits', 'Category', 
    'Active Time (ms)', 'Clicks', 'Keystrokes', 'Focus Session'
  ];

  const csvRows = [
    headers.join(','),
    ...data.map(row => [
      row.date.toISOString().split('T')[0],
      row.domain,
      row.timeSpent,
      row.visits,
      row.category,
      row.activeTime,
      row.clicks,
      row.keystrokes,
      row.focusSession?.isInFocusMode ? 'Yes' : 'No'
    ].join(','))
  ];

  return csvRows.join('\n');
}

module.exports = router;
