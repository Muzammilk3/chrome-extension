const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
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

    const { name, avatar } = req.body;
    const updateFields = {};

    if (name) updateFields.name = name;
    if (avatar) updateFields.avatar = avatar;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser.getPublicProfile()
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating profile'
    });
  }
});

// @route   PUT /api/users/settings
// @desc    Update user settings
// @access  Private
router.put('/settings', [
  body('defaultFocusDuration')
    .optional()
    .isInt({ min: 5, max: 180 })
    .withMessage('Focus duration must be between 5 and 180 minutes'),
  body('workHours.start')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Work start time must be in HH:MM format'),
  body('workHours.end')
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Work end time must be in HH:MM format'),
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  body('notifications')
    .optional()
    .isObject()
    .withMessage('Notifications must be an object'),
  body('privacy')
    .optional()
    .isObject()
    .withMessage('Privacy settings must be an object')
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
      defaultFocusDuration,
      workHours,
      timezone,
      notifications,
      privacy
    } = req.body;

    const updateFields = {};

    if (defaultFocusDuration !== undefined) {
      updateFields['settings.defaultFocusDuration'] = defaultFocusDuration;
    }

    if (workHours) {
      if (workHours.start) updateFields['settings.workHours.start'] = workHours.start;
      if (workHours.end) updateFields['settings.workHours.end'] = workHours.end;
    }

    if (timezone) updateFields['settings.timezone'] = timezone;

    if (notifications) {
      Object.keys(notifications).forEach(key => {
        updateFields[`settings.notifications.${key}`] = notifications[key];
      });
    }

    if (privacy) {
      Object.keys(privacy).forEach(key => {
        updateFields[`settings.privacy.${key}`] = privacy[key];
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: updatedUser.settings
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating settings'
    });
  }
});

// @route   GET /api/users/blocked-sites
// @desc    Get user's blocked sites
// @access  Private
router.get('/blocked-sites', async (req, res) => {
  try {
    res.json({
      success: true,
      blockedSites: req.user.settings.blockedSites
    });
  } catch (error) {
    console.error('Get blocked sites error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching blocked sites'
    });
  }
});

// @route   PUT /api/users/blocked-sites
// @desc    Update user's blocked sites list
// @access  Private
router.put('/blocked-sites', [
  body('blockedSites')
    .isArray()
    .withMessage('Blocked sites must be an array'),
  body('blockedSites.*')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Each blocked site must be a non-empty string')
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

    const { blockedSites } = req.body;

    // Normalize domains (remove www, convert to lowercase)
    const normalizedSites = blockedSites.map(site => 
      site.toLowerCase().replace(/^www\./, '')
    );

    // Remove duplicates
    const uniqueSites = [...new Set(normalizedSites)];

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { 'settings.blockedSites': uniqueSites },
      { new: true, runValidators: true }
    );

    // Update stats
    await updatedUser.updateStats({
      totalSitesBlocked: uniqueSites.length
    });

    res.json({
      success: true,
      message: 'Blocked sites updated successfully',
      blockedSites: updatedUser.settings.blockedSites
    });

  } catch (error) {
    console.error('Update blocked sites error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating blocked sites'
    });
  }
});

// @route   POST /api/users/blocked-sites
// @desc    Add a site to blocked list
// @access  Private
router.post('/blocked-sites', [
  body('site')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Site must be a non-empty string')
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

    const { site } = req.body;
    
    await req.user.addBlockedSite(site);

    res.json({
      success: true,
      message: 'Site added to blocked list',
      blockedSites: req.user.settings.blockedSites
    });

  } catch (error) {
    console.error('Add blocked site error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while adding blocked site'
    });
  }
});

// @route   DELETE /api/users/blocked-sites/:site
// @desc    Remove a site from blocked list
// @access  Private
router.delete('/blocked-sites/:site', async (req, res) => {
  try {
    const { site } = req.params;
    
    await req.user.removeBlockedSite(site);

    res.json({
      success: true,
      message: 'Site removed from blocked list',
      blockedSites: req.user.settings.blockedSites
    });

  } catch (error) {
    console.error('Remove blocked site error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while removing blocked site'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      ...req.user.stats,
      isPremium: req.user.isPremium(),
      memberSince: req.user.createdAt,
      lastActive: req.user.stats.lastActiveDate
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching statistics'
    });
  }
});

// @route   PUT /api/users/stats
// @desc    Update user statistics (for internal use)
// @access  Private
router.put('/stats', [
  body('focusSessionCompleted')
    .optional()
    .isBoolean()
    .withMessage('Focus session completed must be boolean'),
  body('sessionDuration')
    .optional()
    .isNumeric()
    .withMessage('Session duration must be numeric'),
  body('sitesBlockedCount')
    .optional()
    .isNumeric()
    .withMessage('Sites blocked count must be numeric')
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

    const { focusSessionCompleted, sessionDuration, sitesBlockedCount } = req.body;
    const statsUpdate = {};

    if (focusSessionCompleted) {
      statsUpdate.totalFocusSessions = req.user.stats.totalFocusSessions + 1;
      
      // Update streak
      const today = new Date();
      const lastActive = req.user.stats.lastActiveDate;
      
      if (lastActive) {
        const daysDiff = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // Consecutive day
          statsUpdate.currentStreak = req.user.stats.currentStreak + 1;
        } else if (daysDiff === 0) {
          // Same day
          statsUpdate.currentStreak = req.user.stats.currentStreak;
        } else {
          // Streak broken
          statsUpdate.currentStreak = 1;
        }
      } else {
        statsUpdate.currentStreak = 1;
      }
      
      // Update longest streak
      if (statsUpdate.currentStreak > req.user.stats.longestStreak) {
        statsUpdate.longestStreak = statsUpdate.currentStreak;
      }
    }

    if (sessionDuration) {
      statsUpdate.totalTimeTracked = req.user.stats.totalTimeTracked + sessionDuration;
    }

    if (sitesBlockedCount) {
      statsUpdate.totalSitesBlocked = req.user.stats.totalSitesBlocked + sitesBlockedCount;
    }

    await req.user.updateStats(statsUpdate);

    res.json({
      success: true,
      message: 'Statistics updated successfully',
      stats: req.user.stats
    });

  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating statistics'
    });
  }
});

// @route   PUT /api/users/password
// @desc    Change user password
// @access  Private
router.put('/password', [
  body('currentPassword')
    .exists()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
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

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while changing password'
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete('/account', [
  body('password')
    .exists()
    .withMessage('Password is required to delete account')
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

    const { password } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify password (skip for Google OAuth users)
    if (user.password) {
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'Password is incorrect'
        });
      }
    }

    // Soft delete - deactivate account
    user.isActive = false;
    await user.save();

    // TODO: In production, you might want to:
    // 1. Delete all associated data
    // 2. Send confirmation email
    // 3. Schedule permanent deletion after grace period

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting account'
    });
  }
});

module.exports = router;
