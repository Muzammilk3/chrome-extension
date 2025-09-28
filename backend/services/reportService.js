const Report = require('../models/Report');
const TrackingData = require('../models/TrackingData');
const User = require('../models/User');
const emailService = require('./emailService');
const cron = require('node-cron');

class ReportService {
  constructor() {
    this.scheduledJobs = new Map();
    this.setupDailyReportSchedule();
    this.setupWeeklyReportSchedule();
    this.setupCleanupSchedule();
  }

  // Generate daily report for a user
  async generateDailyReport(userId, date = new Date()) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user wants automatic reports
      if (!user.settings.notifications.dailyReports) {
        return null;
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Check if report already exists
      const existingReport = await Report.findOne({
        userId,
        type: 'daily',
        'period.start': startOfDay,
        'period.end': endOfDay
      });

      if (existingReport && existingReport.status === 'completed') {
        return existingReport;
      }

      // Create new report
      const report = new Report({
        userId,
        type: 'daily',
        period: { start: startOfDay, end: endOfDay }
      });

      // Get tracking data for the day
      const trackingData = await TrackingData.find({
        userId,
        date: { $gte: startOfDay, $lte: endOfDay }
      });

      if (trackingData.length === 0) {
        report.status = 'no_data';
        await report.save();
        return report;
      }

      // Calculate metrics
      await report.calculateMetrics(trackingData);
      report.generateInsights();
      report.status = 'completed';
      
      await report.save();

      // Send email notification if enabled
      if (user.settings.notifications.emailReports) {
        await this.sendDailyReportEmail(user, report);
      }

      return report;

    } catch (error) {
      console.error('Error generating daily report:', error);
      throw error;
    }
  }

  // Generate weekly report for a user
  async generateWeeklyReport(userId, startDate = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.settings.notifications.weeklyReports) {
        return null;
      }

      // Default to last Monday to Sunday
      if (!startDate) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - mondayOffset - 7);
        startDate.setHours(0, 0, 0, 0);
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      // Check if report already exists
      const existingReport = await Report.findOne({
        userId,
        type: 'weekly',
        'period.start': startDate,
        'period.end': endDate
      });

      if (existingReport && existingReport.status === 'completed') {
        return existingReport;
      }

      const report = new Report({
        userId,
        type: 'weekly',
        period: { start: startDate, end: endDate }
      });

      const trackingData = await TrackingData.find({
        userId,
        date: { $gte: startDate, $lte: endDate }
      });

      if (trackingData.length === 0) {
        report.status = 'no_data';
        await report.save();
        return report;
      }

      await report.calculateMetrics(trackingData);

      // Generate daily breakdown for weekly report
      const dailyBreakdown = await this.generateDailyBreakdown(userId, startDate, endDate);
      report.dailyBreakdown = dailyBreakdown;
      
      report.generateInsights();
      report.status = 'completed';
      
      await report.save();

      // Send email notification if enabled
      if (user.settings.notifications.emailReports) {
        await this.sendWeeklyReportEmail(user, report);
      }

      return report;

    } catch (error) {
      console.error('Error generating weekly report:', error);
      throw error;
    }
  }

  // Generate monthly report for a user
  async generateMonthlyReport(userId, year = null, month = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.settings.notifications.monthlyReports) {
        return null;
      }

      const now = new Date();
      if (!year) year = now.getFullYear();
      if (!month) month = now.getMonth(); // 0-based

      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const existingReport = await Report.findOne({
        userId,
        type: 'monthly',
        'period.start': startDate,
        'period.end': endDate
      });

      if (existingReport && existingReport.status === 'completed') {
        return existingReport;
      }

      const report = new Report({
        userId,
        type: 'monthly',
        period: { start: startDate, end: endDate }
      });

      const trackingData = await TrackingData.find({
        userId,
        date: { $gte: startDate, $lte: endDate }
      });

      if (trackingData.length === 0) {
        report.status = 'no_data';
        await report.save();
        return report;
      }

      await report.calculateMetrics(trackingData);
      report.generateInsights();
      report.status = 'completed';
      
      await report.save();

      // Send email notification if enabled
      if (user.settings.notifications.emailReports) {
        await this.sendMonthlyReportEmail(user, report);
      }

      return report;

    } catch (error) {
      console.error('Error generating monthly report:', error);
      throw error;
    }
  }

  // Generate daily breakdown for weekly/monthly reports
  async generateDailyBreakdown(userId, startDate, endDate) {
    const breakdown = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const dayData = await TrackingData.find({
        userId,
        date: { $gte: dayStart, $lte: dayEnd }
      });

      const dayMetrics = dayData.reduce((acc, item) => {
        acc.totalTime += item.timeSpent;
        acc.visits += item.visits;
        acc.activeTime += item.activeTime;
        acc.clicks += item.clicks;
        acc.keystrokes += item.keystrokes;

        if (item.category === 'productive') {
          acc.productiveTime += item.timeSpent;
        } else if (['distracting', 'social', 'entertainment'].includes(item.category)) {
          acc.distractingTime += item.timeSpent;
        }

        if (item.focusSession?.isInFocusMode) {
          acc.focusTime += item.timeSpent;
        }

        return acc;
      }, {
        totalTime: 0,
        productiveTime: 0,
        distractingTime: 0,
        focusTime: 0,
        visits: 0,
        activeTime: 0,
        clicks: 0,
        keystrokes: 0
      });

      dayMetrics.productivityScore = dayMetrics.totalTime > 0 ? 
        Math.round((dayMetrics.productiveTime / dayMetrics.totalTime) * 100) : 0;

      breakdown.push({
        date: new Date(d),
        ...dayMetrics
      });
    }

    return breakdown;
  }

  // Send daily report email
  async sendDailyReportEmail(user, report) {
    try {
      const emailData = {
        to: user.email,
        subject: `Daily Productivity Report - ${report.period.start.toDateString()}`,
        template: 'daily-report',
        data: {
          userName: user.name,
          date: report.period.start.toDateString(),
          productivityScore: report.metrics.productivityScore,
          totalTime: this.formatTime(report.metrics.totalTime),
          productiveTime: this.formatTime(report.metrics.productiveTime),
          distractingTime: this.formatTime(report.metrics.distractingTime),
          topSites: report.metrics.topSites.slice(0, 5),
          insights: report.insights.slice(0, 3)
        }
      };

      await emailService.sendEmail(emailData);
      
    } catch (error) {
      console.error('Error sending daily report email:', error);
    }
  }

  // Send weekly report email
  async sendWeeklyReportEmail(user, report) {
    try {
      const emailData = {
        to: user.email,
        subject: `Weekly Productivity Report - Week of ${report.period.start.toDateString()}`,
        template: 'weekly-report',
        data: {
          userName: user.name,
          weekStart: report.period.start.toDateString(),
          weekEnd: report.period.end.toDateString(),
          averageProductivityScore: report.metrics.productivityScore,
          totalTime: this.formatTime(report.metrics.totalTime),
          dailyAverage: this.formatTime(report.metrics.totalTime / 7),
          bestDay: this.getBestDay(report.dailyBreakdown),
          improvements: report.insights.filter(i => i.type === 'improvement').slice(0, 2),
          achievements: report.insights.filter(i => i.type === 'achievement').slice(0, 2)
        }
      };

      await emailService.sendEmail(emailData);
      
    } catch (error) {
      console.error('Error sending weekly report email:', error);
    }
  }

  // Send monthly report email
  async sendMonthlyReportEmail(user, report) {
    try {
      const emailData = {
        to: user.email,
        subject: `Monthly Productivity Report - ${report.period.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        template: 'monthly-report',
        data: {
          userName: user.name,
          month: report.period.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          productivityScore: report.metrics.productivityScore,
          totalTime: this.formatTime(report.metrics.totalTime),
          dailyAverage: this.formatTime(report.metrics.totalTime / 30),
          categoryBreakdown: report.metrics.categoryBreakdown,
          monthlyGoals: user.settings.goals,
          insights: report.insights.slice(0, 5)
        }
      };

      await emailService.sendEmail(emailData);
      
    } catch (error) {
      console.error('Error sending monthly report email:', error);
    }
  }

  // Generate productivity summary for multiple users (admin feature)
  async generateProductivitySummary(userIds, period = 'weekly') {
    try {
      const summary = {
        period,
        generatedAt: new Date(),
        totalUsers: userIds.length,
        users: []
      };

      for (const userId of userIds) {
        try {
          let report;
          switch (period) {
            case 'daily':
              report = await this.generateDailyReport(userId);
              break;
            case 'weekly':
              report = await this.generateWeeklyReport(userId);
              break;
            case 'monthly':
              report = await this.generateMonthlyReport(userId);
              break;
          }

          if (report && report.status === 'completed') {
            summary.users.push({
              userId,
              productivityScore: report.metrics.productivityScore,
              totalTime: report.metrics.totalTime,
              status: 'success'
            });
          } else {
            summary.users.push({
              userId,
              status: 'no_data'
            });
          }
        } catch (error) {
          summary.users.push({
            userId,
            status: 'error',
            error: error.message
          });
        }
      }

      // Calculate aggregate metrics
      const validUsers = summary.users.filter(u => u.status === 'success');
      if (validUsers.length > 0) {
        summary.aggregate = {
          averageProductivityScore: validUsers.reduce((sum, u) => sum + u.productivityScore, 0) / validUsers.length,
          totalTime: validUsers.reduce((sum, u) => sum + u.totalTime, 0),
          activeUsers: validUsers.length
        };
      }

      return summary;

    } catch (error) {
      console.error('Error generating productivity summary:', error);
      throw error;
    }
  }

  // Setup scheduled jobs
  setupDailyReportSchedule() {
    // Run daily reports at 7 AM
    cron.schedule('0 7 * * *', async () => {
      console.log('Starting daily report generation...');
      
      try {
        const users = await User.find({
          'settings.notifications.dailyReports': true,
          'settings.notifications.enabled': true
        });

        for (const user of users) {
          try {
            await this.generateDailyReport(user._id);
          } catch (error) {
            console.error(`Error generating daily report for user ${user._id}:`, error);
          }
        }

        console.log(`Daily reports generated for ${users.length} users`);
      } catch (error) {
        console.error('Error in daily report scheduler:', error);
      }
    });
  }

  setupWeeklyReportSchedule() {
    // Run weekly reports on Monday at 8 AM
    cron.schedule('0 8 * * 1', async () => {
      console.log('Starting weekly report generation...');
      
      try {
        const users = await User.find({
          'settings.notifications.weeklyReports': true,
          'settings.notifications.enabled': true
        });

        for (const user of users) {
          try {
            await this.generateWeeklyReport(user._id);
          } catch (error) {
            console.error(`Error generating weekly report for user ${user._id}:`, error);
          }
        }

        console.log(`Weekly reports generated for ${users.length} users`);
      } catch (error) {
        console.error('Error in weekly report scheduler:', error);
      }
    });
  }

  setupCleanupSchedule() {
    // Clean up old reports every Sunday at midnight
    cron.schedule('0 0 * * 0', async () => {
      console.log('Starting report cleanup...');
      
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days of reports

        const result = await Report.deleteMany({
          createdAt: { $lt: cutoffDate },
          type: 'daily' // Only cleanup daily reports, keep weekly/monthly longer
        });

        console.log(`Cleaned up ${result.deletedCount} old daily reports`);
      } catch (error) {
        console.error('Error in report cleanup:', error);
      }
    });
  }

  // Utility functions
  formatTime(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  getBestDay(dailyBreakdown) {
    if (!dailyBreakdown || dailyBreakdown.length === 0) return null;
    
    return dailyBreakdown.reduce((best, day) => 
      day.productivityScore > best.productivityScore ? day : best
    );
  }

  // Stop all scheduled jobs (for testing or shutdown)
  stopAllJobs() {
    this.scheduledJobs.forEach(job => {
      job.stop();
    });
    this.scheduledJobs.clear();
  }
}

module.exports = new ReportService();
