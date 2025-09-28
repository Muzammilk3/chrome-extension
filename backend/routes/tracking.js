const express = require('express');
const { body, validationResult, query } = require('express-validator');
const TrackingData = require('../models/TrackingData');

const router = express.Router();

// @route   POST /api/tracking/record
// @desc    Record website tracking data
// @access  Private
router.post('/record', [
  body('domain')
    .exists()
    .isLength({ min: 1 })
    .withMessage('Domain is required'),
  body('timeSpent')
    .isNumeric()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a positive number'),
  body('timestamp')
    .optional()
    .isNumeric()
    .withMessage('Timestamp must be a number')
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

    const {
      domain,
      fullUrl,
      title,
      timeSpent,
      timestamp,
      sessionId,
      activeTime,
      scrollDepth,
      clicks,
      keystrokes,
      focusSession,
      deviceInfo
    } = req.body;

    // Create date from timestamp or use current time
    const recordTime = timestamp ? new Date(timestamp) : new Date();
    const startTime = new Date(recordTime.getTime() - timeSpent);

    // Check if we already have data for this domain today
    const today = new Date(recordTime);
    today.setHours(0, 0, 0, 0);

    let existingRecord = await TrackingData.findOne({
      userId: req.user._id,
      domain: domain.toLowerCase(),
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingRecord) {
      // Update existing record
      existingRecord.timeSpent += timeSpent;
      existingRecord.visits += 1;
      existingRecord.activeTime += activeTime || 0;
      existingRecord.clicks += clicks || 0;
      existingRecord.keystrokes += keystrokes || 0;
      existingRecord.endTime = recordTime;
      
      if (scrollDepth > existingRecord.scrollDepth) {
        existingRecord.scrollDepth = scrollDepth;
      }

      if (focusSession) {
        Object.assign(existingRecord.focusSession, focusSession);
      }

      await existingRecord.save();

      res.json({
        success: true,
        message: 'Tracking data updated successfully',
        data: existingRecord
      });
    } else {
      // Create new record
      const trackingData = new TrackingData({
        userId: req.user._id,
        date: recordTime,
        domain: domain.toLowerCase(),
        fullUrl: fullUrl || `https://${domain}`,
        title: title || '',
        timeSpent,
        visits: 1,
        sessionId,
        activeTime: activeTime || timeSpent,
        scrollDepth: scrollDepth || 0,
        clicks: clicks || 0,
        keystrokes: keystrokes || 0,
        focusSession: focusSession || {},
        deviceInfo: deviceInfo || {},
        startTime,
        endTime: recordTime
      });

      await trackingData.save();

      // Update user stats
      await req.user.updateStats({
        totalTimeTracked: req.user.stats.totalTimeTracked + timeSpent,
        lastActiveDate: recordTime
      });

      res.status(201).json({
        success: true,
        message: 'Tracking data recorded successfully',
        data: trackingData
      });
    }

  } catch (error) {
    console.error('Record tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while recording tracking data'
    });
  }
});

// @route   POST /api/tracking/sync
// @desc    Sync bulk tracking data from extension
// @access  Private
router.post('/sync', [
  body('dailyData')
    .isObject()
    .withMessage('Daily data must be an object')
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

    const { dailyData } = req.body;
    const syncResults = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: []
    };

    // Process each day's data
    for (const [dateString, dayData] of Object.entries(dailyData)) {
      try {
        const date = new Date(dateString);
        
        // Process each domain for this day
        for (const [domain, domainData] of Object.entries(dayData)) {
          try {
            syncResults.processed++;

            // Check if record exists
            let existingRecord = await TrackingData.findOne({
              userId: req.user._id,
              domain: domain.toLowerCase(),
              date: {
                $gte: new Date(date.getTime()),
                $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000)
              }
            });

            if (existingRecord) {
              // Update if new data has more time
              if (domainData.timeSpent > existingRecord.timeSpent) {
                existingRecord.timeSpent = domainData.timeSpent;
                existingRecord.visits = domainData.visits || existingRecord.visits;
                existingRecord.endTime = domainData.lastVisit ? 
                  new Date(domainData.lastVisit) : existingRecord.endTime;
                
                await existingRecord.save();
                syncResults.updated++;
              }
            } else {
              // Create new record
              const trackingData = new TrackingData({
                userId: req.user._id,
                date,
                domain: domain.toLowerCase(),
                fullUrl: `https://${domain}`,
                timeSpent: domainData.timeSpent,
                visits: domainData.visits || 1,
                activeTime: domainData.timeSpent, // Assume all time was active for sync
                startTime: new Date(date.getTime()),
                endTime: domainData.lastVisit ? 
                  new Date(domainData.lastVisit) : 
                  new Date(date.getTime() + domainData.timeSpent)
              });

              await trackingData.save();
              syncResults.created++;
            }

          } catch (domainError) {
            syncResults.errors.push({
              domain,
              date: dateString,
              error: domainError.message
            });
          }
        }

      } catch (dateError) {
        syncResults.errors.push({
          date: dateString,
          error: dateError.message
        });
      }
    }

    // Update user total time tracked
    const totalSyncedTime = Object.values(dailyData)
      .reduce((total, dayData) => {
        return total + Object.values(dayData)
          .reduce((dayTotal, domainData) => dayTotal + (domainData.timeSpent || 0), 0);
      }, 0);

    if (totalSyncedTime > 0) {
      await req.user.updateStats({
        totalTimeTracked: req.user.stats.totalTimeTracked + totalSyncedTime,
        lastActiveDate: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Data synced successfully',
      results: syncResults
    });

  } catch (error) {
    console.error('Sync tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during data sync'
    });
  }
});

// @route   GET /api/tracking/daily
// @desc    Get daily tracking summary
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
    
    const dailySummary = await TrackingData.getDailySummary(req.user._id, date);

    // Calculate total metrics
    const totalMetrics = dailySummary.reduce((acc, item) => {
      acc.totalTime += item.totalTime;
      acc.totalActiveTime += item.totalActiveTime;
      acc.totalVisits += item.totalVisits;
      
      // Category-based calculations
      switch (item.category) {
        case 'productive':
          acc.productiveTime += item.totalTime;
          break;
        case 'distracting':
        case 'social':
        case 'entertainment':
          acc.distractingTime += item.totalTime;
          break;
        default:
          acc.neutralTime += item.totalTime;
      }
      
      return acc;
    }, {
      totalTime: 0,
      totalActiveTime: 0,
      totalVisits: 0,
      productiveTime: 0,
      distractingTime: 0,
      neutralTime: 0
    });

    // Calculate productivity score
    const productivityScore = totalMetrics.totalTime > 0 ? 
      Math.round((totalMetrics.productiveTime / totalMetrics.totalTime) * 100) : 0;

    res.json({
      success: true,
      data: {
        date: date.toISOString().split('T')[0],
        summary: dailySummary,
        metrics: {
          ...totalMetrics,
          productivityScore,
          uniqueDomains: dailySummary.length
        }
      }
    });

  } catch (error) {
    console.error('Get daily tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching daily data'
    });
  }
});

// @route   GET /api/tracking/weekly
// @desc    Get weekly tracking summary
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
      return date;
    })();

    const weeklyData = await TrackingData.getProductivityTrend(req.user._id, 7);

    res.json({
      success: true,
      data: {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        dailyBreakdown: weeklyData
      }
    });

  } catch (error) {
    console.error('Get weekly tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching weekly data'
    });
  }
});

// @route   GET /api/tracking/categories
// @desc    Get category breakdown for a period
// @access  Private
router.get('/categories', [
  query('startDate')
    .optional()
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

    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate ? new Date(req.query.startDate) : (() => {
      const date = new Date(endDate);
      date.setDate(date.getDate() - 7);
      return date;
    })();

    const categoryBreakdown = await TrackingData.getCategoryBreakdown(
      req.user._id, 
      startDate, 
      endDate
    );

    // Calculate percentages
    const totalTime = categoryBreakdown.reduce((total, cat) => total + cat.totalTime, 0);
    const categoriesWithPercentages = categoryBreakdown.map(cat => ({
      ...cat,
      percentage: totalTime > 0 ? Math.round((cat.totalTime / totalTime) * 100) : 0
    }));

    res.json({
      success: true,
      data: {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        totalTime,
        categories: categoriesWithPercentages
      }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching category data'
    });
  }
});

// @route   DELETE /api/tracking/data
// @desc    Delete tracking data for a specific period
// @access  Private
router.delete('/data', [
  query('startDate')
    .isISO8601()
    .withMessage('Start date is required and must be in ISO format'),
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

    const startDate = new Date(req.query.startDate);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const deleteResult = await TrackingData.deleteMany({
      userId: req.user._id,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });

    res.json({
      success: true,
      message: `Deleted ${deleteResult.deletedCount} tracking records`,
      deletedCount: deleteResult.deletedCount
    });

  } catch (error) {
    console.error('Delete tracking data error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting tracking data'
    });
  }
});

module.exports = router;
