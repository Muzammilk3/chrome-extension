// Popup JavaScript - Advanced functionality with animations
class ProductivityPopup {
  constructor() {
    this.currentTab = 'dashboard';
    this.user = null;
    this.focusTimer = null;
    this.charts = {};
    this.isRegisterMode = false; // Track if we're in registration mode
    
    this.init();
  }

  async init() {
    console.log('Popup initialization started');
    
    // Force immediate display and layout fix first
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.getElementById('app');
    
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      console.log('Loading screen hidden');
    } else {
      console.warn('Loading screen element not found');
    }
    
    if (app) {
      app.classList.remove('initially-hidden');
      app.classList.add('visible');
      console.log('App container displayed');
    } else {
      console.warn('App container element not found');
    }
    
    // Fix dashboard layout immediately
    this.fixDashboardLayout();
    
    // Initialize components synchronously for instant response
    console.log('Setting up event listeners...');
    this.setupEventListeners();
    console.log('Setting up tab navigation...');
    this.setupTabNavigation();
    console.log('Setting up quick add buttons...');
    this.setupQuickAddButtons();
    
    // Load data asynchronously in background without awaiting
    this.loadUserData().catch(console.log);
    this.loadDashboardData().catch(console.log);
    this.loadBlockedSites().catch(console.log);
    this.loadProductiveSites().catch(console.log);
    
    // Setup periodic updates
    this.setupPeriodicUpdates();
    
    console.log('Popup initialization completed');
  }

  showLoading() {
    // No longer needed - keeping for compatibility
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.getElementById('app');
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (app) {
      app.classList.remove('initially-hidden');
      app.classList.add('visible');
    }
  }

  hideLoading() {
    // Show app immediately for instant response
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.getElementById('app');
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (app) {
      app.classList.remove('initially-hidden');
      app.classList.add('visible');
    }
    
    // Force layout recalculation for dashboard immediately
    this.fixDashboardLayout();
  }

  fixDashboardLayout() {
    // Use requestAnimationFrame for optimized layout updates
    requestAnimationFrame(() => {
      const dashboard = document.getElementById('dashboard');
      const appContainer = document.querySelector('.app-container');
      
      if (dashboard && appContainer) {
        // Set styles efficiently in batch
        Object.assign(dashboard.style, {
          width: '100%',
          minWidth: '390px',
          boxSizing: 'border-box'
        });
        
        // Ensure stats grid has correct width
        const statsGrid = dashboard.querySelector('.stats-grid');
        if (statsGrid) {
          Object.assign(statsGrid.style, {
            width: '100%',
            minWidth: '360px',
            boxSizing: 'border-box'
          });
        }
      }
    });
  }

  setupEventListeners() {
    // Helper function to safely add event listeners
    const safeAddEventListener = (elementId, event, callback) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.addEventListener(event, callback);
      } else {
        console.warn(`Element not found: ${elementId}`);
      }
    };

    // Dashboard
    safeAddEventListener('refreshBtn', 'click', () => this.refreshDashboard());

    // Extension Reload Button (for debugging connection issues)
    const reloadBtn = document.getElementById('reloadExtensionBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.reloadExtension());
    }

    // Focus Mode
    document.querySelectorAll('.duration-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.selectDuration(e));
    });
    safeAddEventListener('startFocusBtn', 'click', () => this.startFocusMode());
    safeAddEventListener('stopFocusBtn', 'click', () => this.stopFocusMode());

    // Site Blocking
    safeAddEventListener('addSiteBtn', 'click', () => this.addBlockedSite());
    const newSiteInput = document.getElementById('newSiteInput');
    if (newSiteInput) {
      newSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addBlockedSite();
      });
    }

    // Focus Mode Site Blocking - with null checks
    const addFocusSiteBtn = document.getElementById('addFocusSiteBtn');
    const focusSiteInput = document.getElementById('focusSiteInput');
    
    if (addFocusSiteBtn) {
      addFocusSiteBtn.addEventListener('click', () => this.addFocusBlockedSite());
    }
    
    if (focusSiteInput) {
      focusSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addFocusBlockedSite();
      });
    }

    // Productive Sites Management - with null checks
    const addProductiveSiteBtn = document.getElementById('addProductiveSiteBtn');
    const productiveSiteInput = document.getElementById('productiveSiteInput');
    
    if (addProductiveSiteBtn) {
      addProductiveSiteBtn.addEventListener('click', () => this.addProductiveSite());
    }
    
    if (productiveSiteInput) {
      productiveSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addProductiveSite();
      });
    }
    
    // Quick-add buttons will be set up when the blocking tab is loaded
    this.setupQuickAddButtons();

    // Reports
    document.querySelectorAll('.report-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchReportPeriod(e));
    });
  }

  setupTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(tabName);
    
    if (tabBtn) {
      tabBtn.classList.add('active');
    } else {
      console.warn(`Tab button not found for: ${tabName}`);
    }
    
    if (tabContent) {
      tabContent.classList.add('active');
    } else {
      console.warn(`Tab content not found for: ${tabName}`);
    }

    this.currentTab = tabName;

    // Fix layout for dashboard specifically
    if (tabName === 'dashboard') {
      setTimeout(() => this.fixDashboardLayout(), 50);
    }

    // Load tab-specific data
    switch (tabName) {
      case 'dashboard':
        this.loadDashboardData();
        break;
      case 'focus':
        this.loadFocusData();
        break;
      case 'blocking':
        this.loadBlockedSites();
        this.loadFocusBlockedSites();
        this.setupQuickAddButtons(); // Set up quick-add buttons when blocking tab is active
        break;
      case 'reports':
        this.loadReportsData();
        break;
    }
  }

  setupQuickAddButtons() {
    // Remove existing event listeners first
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
      btn.removeEventListener('click', this.quickAddSiteHandler);
    });
    
    // Add new event listeners with proper binding
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
      this.quickAddSiteHandler = (e) => this.quickAddSite(e);
      btn.addEventListener('click', this.quickAddSiteHandler);
    });
  }

  // Helper method to get productive sites from storage for stats calculations
  async getProductiveSitesForStats() {
    try {
      const productiveSites = await this.sendMessageWithTimeout({ action: 'getProductiveSites' });
      return productiveSites || [];
    } catch (error) {
      console.log('Could not get productive sites for stats, using empty array');
      return [];
    }
  }

  // Helper function to send messages with timeout and retry
  async sendMessageWithTimeout(message, timeout = 3000, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Message timeout'));
          }, timeout);
          
          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      } catch (error) {
        console.log(`Attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === retries) {
          // If this is the last attempt, try to wake up the service worker
          if (error.message.includes('Receiving end does not exist')) {
            console.log('Service worker appears to be inactive, attempting to wake it up...');
            try {
              // Try to query tabs to wake up the service worker
              await chrome.tabs.query({ active: true, currentWindow: true });
              // Wait a bit for service worker to initialize
              await new Promise(resolve => setTimeout(resolve, 500));
              // Retry once more
              return await this.sendMessageWithTimeout(message, timeout, 0);
            } catch (wakeError) {
              console.log('Failed to wake up service worker:', wakeError);
            }
          }
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  async loadUserData() {
    try {
      const response = await this.sendMessageWithTimeout({ action: 'getUser' });
      this.user = response;
      
      // User authentication removed - extension now works without login
    } catch (error) {
      console.log('Info: Authentication disabled, extension works without login');
    }
  }

  async loadDashboardData() {
    try {
      // Show loading state
      const statsContainer = document.querySelector('.dashboard-content');
      if (statsContainer) {
        statsContainer.style.opacity = '0.7';
      }

      // Get today's stats with timeout and retry
      const stats = await this.sendMessageWithTimeout({ action: 'getTodayStats' });
      this.updateDashboardStats(stats);

      // Get productivity score with timeout and retry
      const scoreData = await this.sendMessageWithTimeout({ action: 'getProductivityScore' });
      this.updateProductivityScore(scoreData);

      // Restore normal opacity
      if (statsContainer) {
        statsContainer.style.opacity = '1';
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error.message);
      
      // Show user-friendly error message
      this.showConnectionError();
      
      // Show default/empty stats if loading fails
      this.updateDashboardStats({});
      this.updateProductivityScore({ score: 0, trend: 'stable' });
      
      // Restore normal opacity
      const statsContainer = document.querySelector('.dashboard-content');
      if (statsContainer) {
        statsContainer.style.opacity = '1';
      }
    }
  }

  showConnectionError() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'connection-error';
    errorDiv.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Connection issue detected. Click to reload extension.</span>
        <button id="reloadExtensionBtn" class="reload-btn">Reload</button>
      </div>
    `;
    
    // Remove existing error message
    const existingError = document.querySelector('.connection-error');
    if (existingError) {
      existingError.remove();
    }
    
    // Add to dashboard
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardContent) {
      dashboardContent.insertBefore(errorDiv, dashboardContent.firstChild);
      
      // Add reload functionality
      document.getElementById('reloadExtensionBtn').addEventListener('click', () => {
        chrome.runtime.reload();
      });
    }
  }

  async updateDashboardStats(stats) {
    let totalTime = 0;
    let productiveTime = 0;
    let distractingTime = 0;
    const topSites = [];

    // Get productive sites dynamically from storage
    const productiveSites = await this.getProductiveSitesForStats();
    const distractingSites = ['youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'reddit.com'];

    // Calculate stats
    for (const [domain, data] of Object.entries(stats)) {
      totalTime += data.timeSpent;
      topSites.push({ domain, timeSpent: data.timeSpent, visits: data.visits });

      if (productiveSites.some(site => domain.includes(site))) {
        productiveTime += data.timeSpent;
      }
      if (distractingSites.some(site => domain.includes(site))) {
        distractingTime += data.timeSpent;
      }
    }

    topSites.sort((a, b) => b.timeSpent - a.timeSpent);

    // Update UI - only update elements that exist
    // Note: totalTime, productiveTime, distractingTime elements were removed with stats cards
    this.updateTopSites(topSites.slice(0, 5));
  }

  updateProductivityScore(scoreData) {
    const score = scoreData.score || 0;
    const message = scoreData.message || 'Start browsing to see your score!';

    // Animate score
    this.animateScore(score);
    
    // Update message
    const scoreMessageElement = document.getElementById('scoreMessage');
    if (scoreMessageElement) {
      scoreMessageElement.textContent = message;
    }
  }

  animateScore(targetScore) {
    const scoreElement = document.getElementById('scoreValue');
    const circleElement = document.getElementById('scoreCircle');
    
    if (!scoreElement || !circleElement) {
      console.warn('Score elements not found');
      return;
    }
    
    let currentScore = 0;
    const increment = targetScore / 50; // 50 steps animation
    
    const animation = setInterval(() => {
      currentScore += increment;
      
      if (currentScore >= targetScore) {
        currentScore = targetScore;
        clearInterval(animation);
      }
      
      // Update text
      scoreElement.textContent = Math.round(currentScore);
      
      // Update circle (circumference = 2 * π * r = 314)
      const offset = 314 - (currentScore / 100) * 314;
      circleElement.style.strokeDashoffset = offset;
      
      // Change color based on score
      if (currentScore >= 80) {
        circleElement.style.stroke = '#4ade80';
      } else if (currentScore >= 60) {
        circleElement.style.stroke = '#f59e0b';
      } else {
        circleElement.style.stroke = '#ef4444';
      }
    }, 20);
  }

  updateTopSites(sites) {
    const container = document.getElementById('topSitesList');
    
    if (sites.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <i class="fas fa-chart-bar"></i>
          <p>No browsing data yet. Start browsing to see your top sites!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sites.map(site => `
      <div class="site-item">
        <div class="site-info">
          <div class="site-favicon">${site.domain.charAt(0).toUpperCase()}</div>
          <span class="site-name">${site.domain}</span>
        </div>
        <span class="site-time">${this.formatTime(site.timeSpent)}</span>
      </div>
    `).join('');
  }

  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }

  async refreshDashboard() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.style.transform = 'rotate(360deg)';
    
    await this.loadDashboardData();
    
    setTimeout(() => {
      refreshBtn.style.transform = 'rotate(0deg)';
    }, 500);
  }

  async reloadExtension() {
    const reloadBtn = document.getElementById('reloadExtensionBtn');
    if (reloadBtn) {
      reloadBtn.style.transform = 'rotate(360deg)';
    }
    
    try {
      // Try to reload the extension
      if (chrome.runtime && chrome.runtime.reload) {
        chrome.runtime.reload();
      } else {
        // Fallback: Show message to manually reload
        this.showError('Please manually reload the extension from chrome://extensions/');
      }
    } catch (error) {
      console.error('Error reloading extension:', error);
      this.showError('Please manually reload the extension from chrome://extensions/');
    }
    
    setTimeout(() => {
      if (reloadBtn) {
        reloadBtn.style.transform = 'rotate(0deg)';
      }
    }, 500);
  }

  // Focus Mode Functions
  selectDuration(e) {
    document.querySelectorAll('.duration-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
  }

  async loadFocusData() {
    try {
      const focusData = await chrome.runtime.sendMessage({ action: 'getFocusStatus' });
      
      // Load focus blocked sites when focus tab is opened
      this.loadFocusBlockedSites();
      
      if (focusData && focusData.active) {
        this.showActiveFocusMode(focusData);
      } else {
        this.showInactiveFocusMode();
      }
    } catch (error) {
      console.error('Error loading focus data:', error);
    }
  }

  showActiveFocusMode(focusData) {
    const focusControls = document.getElementById('focusControls');
    const focusTimer = document.getElementById('focusTimer');
    const focusStatusText = document.getElementById('focusStatusText');
    
    if (focusControls) focusControls.classList.add('hidden');
    if (focusTimer) {
      focusTimer.classList.remove('initially-hidden', 'hidden');
      focusTimer.classList.add('visible');
    }
    if (focusStatusText) focusStatusText.textContent = 'Focus mode active';
    
    // Start timer display
    this.startTimerDisplay(focusData.endTime);
  }

  showInactiveFocusMode() {
    const focusControls = document.getElementById('focusControls');
    const focusTimer = document.getElementById('focusTimer');
    const focusStatusText = document.getElementById('focusStatusText');
    
    if (focusControls) {
      focusControls.classList.remove('hidden');
      focusControls.classList.add('visible');
    }
    if (focusTimer) {
      focusTimer.classList.add('initially-hidden', 'hidden');
      focusTimer.classList.remove('visible');
    }
    if (focusStatusText) focusStatusText.textContent = 'Ready to focus';
  }

  async startFocusMode() {
    const selectedDuration = document.querySelector('.duration-btn.active').dataset.duration;
    
    // Get the focus-specific blocked sites (not the permanent ones)
    let focusBlockedSites = [];
    try {
      focusBlockedSites = await this.sendMessageWithTimeout({ action: 'getFocusBlockedSites' });
    } catch (error) {
      console.log('Could not get focus blocked sites, using default list');
      focusBlockedSites = ['youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'reddit.com'];
    }

    try {
      await chrome.runtime.sendMessage({
        action: 'startFocusMode',
        duration: parseInt(selectedDuration),
        blockedSites: focusBlockedSites
      });

      // Show success animation
      this.showFocusStartAnimation();
      
      // Reload focus data
      setTimeout(() => {
        this.loadFocusData();
      }, 1000);

    } catch (error) {
      console.error('Error starting focus mode:', error);
    }
  }

  showFocusStartAnimation() {
    const indicator = document.querySelector('.focus-indicator');
    if (indicator) {
      indicator.style.animation = 'none';
      setTimeout(() => {
        if (indicator) {
          indicator.style.animation = 'focusPulse 2s ease-in-out infinite';
        }
      }, 100);
    }
  }

  async stopFocusMode() {
    try {
      await chrome.runtime.sendMessage({ action: 'stopFocusMode' });
      
      if (this.focusTimer) {
        clearInterval(this.focusTimer);
      }
      
      this.showInactiveFocusMode();
    } catch (error) {
      console.error('Error stopping focus mode:', error);
    }
  }

  startTimerDisplay(endTime) {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = endTime - now;
      
      if (remaining <= 0) {
        this.showInactiveFocusMode();
        return;
      }
      
      const minutes = Math.floor(remaining / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      
      const timerDisplayElement = document.getElementById('timerDisplay');
      if (timerDisplayElement) {
        timerDisplayElement.textContent = 
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      
      // Update circle progress
      const durationBtn = document.querySelector('.duration-btn.active');
      if (durationBtn) {
        const totalDuration = parseInt(durationBtn.dataset.duration) * 60 * 1000;
        const elapsed = totalDuration - remaining;
        const progress = elapsed / totalDuration;
        const circumference = 2 * Math.PI * 90; // radius = 90
        const offset = circumference - (progress * circumference);
        
        const timerCircle = document.getElementById('timerCircle');
        if (timerCircle) {
          timerCircle.style.strokeDasharray = circumference;
          timerCircle.style.strokeDashoffset = offset;
        }
      }
    };

    updateTimer();
    this.focusTimer = setInterval(updateTimer, 1000);
  }

  // Site Blocking Functions
  async loadBlockedSites() {
    try {
      const blockedSites = await chrome.runtime.sendMessage({ action: 'getBlockedSites' });
      this.updateBlockedSitesList(blockedSites);
    } catch (error) {
      console.error('Error loading blocked sites:', error);
    }
  }

  updateBlockedSitesList(sites) {
    const container = document.getElementById('blockedSitesList');
    
    if (!container) {
      console.warn('Blocked sites list container not found');
      return;
    }
    
    if (sites.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <i class="fas fa-shield-alt"></i>
          <p>No blocked sites yet. Add sites you want to block permanently.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sites.map((site, index) => `
      <div class="blocked-site-item" data-site="${site}">
        <div class="blocked-site-info">
          <div class="blocked-site-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2"/>
              <path d="m15 9-6 6" stroke="#ef4444" stroke-width="2"/>
              <path d="m9 9 6 6" stroke="#ef4444" stroke-width="2"/>
            </svg>
          </div>
          <span class="blocked-site-name">${site}</span>
        </div>
        <button class="remove-site-btn" data-site="${site}" title="Click to remove ${site}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="delete-text">Remove</span>
        </button>
      </div>
    `).join('');
    
    // Add event listeners to all remove buttons
    this.setupRemoveButtons();
  }

  setupRemoveButtons() {
    const removeButtons = document.querySelectorAll('.remove-site-btn');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const site = button.getAttribute('data-site');
        if (site) {
          this.confirmAndRemoveSite(site, button);
        }
      });
    });
  }

  async confirmAndRemoveSite(site, buttonElement) {
    // Add visual feedback
    buttonElement.style.transform = 'scale(0.9)';
    buttonElement.style.opacity = '0.7';
    
    // Show confirmation dialog
    const confirmed = confirm(`Are you sure you want to unblock "${site}"?\n\nThis site will no longer be blocked and you'll be able to access it freely.`);
    
    if (confirmed) {
      try {
        await this.removeBlockedSite(site);
        this.showSuccess(`${site} has been removed from blocked sites!`);
      } catch (error) {
        // Reset button if error
        buttonElement.style.transform = 'scale(1)';
        buttonElement.style.opacity = '1';
        this.showError(`Failed to remove ${site}. Please try again.`);
      }
    } else {
      // Reset button if cancelled
      buttonElement.style.transform = 'scale(1)';
      buttonElement.style.opacity = '1';
    }
  }

  async addBlockedSite() {
    const input = document.getElementById('newSiteInput');
    const site = input.value.trim();
    
    if (!site) return;
    
    // Validate domain format
    if (!this.isValidDomain(site)) {
      this.showError('Please enter a valid domain (e.g., facebook.com)');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        action: 'addBlockedSite',
        site: site
      });

      input.value = '';
      this.loadBlockedSites();
      this.showSuccess('Site blocked successfully!');
    } catch (error) {
      console.error('Error adding blocked site:', error);
      this.showError('Failed to add blocked site');
    }
  }

  async removeBlockedSite(site) {
    try {
      await chrome.runtime.sendMessage({
        action: 'removeBlockedSite',
        site: site
      });

      this.loadBlockedSites();
      this.showSuccess('Site unblocked successfully!');
    } catch (error) {
      console.error('Error removing blocked site:', error);
      this.showError('Failed to remove blocked site');
    }
  }

  async quickAddSite(e) {
    const site = e.currentTarget.dataset.site;
    
    try {
      await chrome.runtime.sendMessage({
        action: 'addBlockedSite',
        site: site
      });

      this.loadBlockedSites();
      this.showSuccess(`${site} blocked successfully!`);
      
      // Animate button with null check
      if (e.currentTarget && e.currentTarget.style) {
        e.currentTarget.style.transform = 'scale(0.95)';
        setTimeout(() => {
          if (e.currentTarget && e.currentTarget.style) {
            e.currentTarget.style.transform = 'scale(1)';
          }
        }, 150);
      }
    } catch (error) {
      console.error('Error quick adding site:', error);
      this.showError('Failed to add blocked site');
    }
  }

  // Focus Mode Site Blocking Functions
  async addFocusBlockedSite() {
    const input = document.getElementById('focusSiteInput');
    if (!input) {
      this.showError('Focus site input not found');
      return;
    }
    
    const site = input.value.trim();

    if (!site) {
      this.showError('Please enter a website URL');
      return;
    }

    // Clean up the URL
    const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    try {
      // Check if background script is available
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome runtime not available');
      }

      // Send message with error handling
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'addFocusBlockedSite',
          site: cleanSite
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      input.value = '';
      this.loadFocusBlockedSites();
      this.showSuccess(`${cleanSite} will be blocked during focus mode!`);
    } catch (error) {
      console.error('Error adding focus blocked site:', error);
      
      // Show specific error message based on the error type
      if (error.message.includes('Could not establish connection')) {
        this.showError('Extension needs to be reloaded. Please reload the extension from chrome://extensions/');
      } else if (error.message.includes('Chrome runtime not available')) {
        this.showError('Chrome extension runtime is not available. Please reload the page.');
      } else {
        this.showError(`Failed to add focus blocked site: ${error.message}`);
      }
    }
  }

  async loadFocusBlockedSites() {
    try {
      // Check if background script is available
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        console.warn('Chrome runtime not available, skipping focus sites load');
        return;
      }

      const focusSites = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getFocusBlockedSites' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || []);
          }
        });
      });
      
      this.updateFocusBlockedSitesList(focusSites);
    } catch (error) {
      console.error('Error loading focus blocked sites:', error);
      
      // Show empty state instead of error to user
      this.updateFocusBlockedSitesList([]);
      
      // Only show error if it's a connection issue
      if (error.message.includes('Could not establish connection')) {
        console.warn('Extension background script not available. Please reload the extension.');
      }
    }
  }

  updateFocusBlockedSitesList(sites) {
    const container = document.getElementById('focusBlockedSitesList');
    
    if (!container) {
      console.warn('Focus blocked sites list container not found');
      return;
    }
    
    if (!sites || sites.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <i class="fas fa-clock"></i>
          <p>No focus-specific blocked sites yet.<br>Add sites to block only during focus sessions.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sites.map((site, index) => `
      <div class="blocked-site-item" data-site="${site}">
        <div class="blocked-site-info">
          <div class="blocked-site-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#f97316" stroke-width="2"/>
              <path d="M15 9l-6 6M9 9l6 6" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="blocked-site-details">
            <div class="blocked-site-url">${site}</div>
            <div class="blocked-site-note">⏰ Active during focus sessions only</div>
          </div>
        </div>
        <button class="remove-site-btn" data-site="${site}" title="Remove from focus mode blocking">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    `).join('');

    this.setupFocusRemoveButtons();
  }

  setupFocusRemoveButtons() {
    document.querySelectorAll('#focusBlockedSitesList .remove-site-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const site = button.getAttribute('data-site');
        if (site) {
          this.confirmAndRemoveFocusSite(site, button);
        }
      });
    });
  }

  async confirmAndRemoveFocusSite(site, buttonElement) {
    // Add visual feedback
    buttonElement.style.transform = 'scale(0.9)';
    buttonElement.style.opacity = '0.7';
    
    // Show confirmation dialog
    const confirmed = confirm(`Are you sure you want to remove "${site}" from focus mode blocking?\n\nThis site will no longer be blocked during focus sessions.`);
    
    if (confirmed) {
      try {
        await this.removeFocusBlockedSite(site);
        this.showSuccess(`${site} has been removed from focus mode blocking!`);
      } catch (error) {
        // Reset button if error
        buttonElement.style.transform = 'scale(1)';
        buttonElement.style.opacity = '1';
        this.showError(`Failed to remove ${site}. Please try again.`);
      }
    } else {
      // Reset button if cancelled
      buttonElement.style.transform = 'scale(1)';
      buttonElement.style.opacity = '1';
    }
  }

  async removeFocusBlockedSite(site) {
    try {
      await chrome.runtime.sendMessage({
        action: 'removeFocusBlockedSite',
        site: site
      });

      this.loadFocusBlockedSites();
      this.showSuccess('Site removed from focus mode blocking!');
    } catch (error) {
      console.error('Error removing focus blocked site:', error);
      this.showError('Failed to remove focus blocked site');
    }
  }

  isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain) || domain.includes('.');
  }

  // Reports Functions
  async loadReportsData() {
    try {
      const weeklyData = await chrome.runtime.sendMessage({ action: 'getWeeklyReport' });
      this.updateProductivityChart(weeklyData);
      await this.updateTimeDistributionChart();
      await this.updateInsights();
    } catch (error) {
      console.error('Error loading reports data:', error);
    }
  }

  switchReportPeriod(e) {
    document.querySelectorAll('.report-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    
    const period = e.target.dataset.period;
    // Load data for selected period
    this.loadReportsData();
  }

  updateProductivityChart(weeklyData) {
    const ctx = document.getElementById('productivityChart').getContext('2d');
    
    if (this.charts.productivity) {
      this.charts.productivity.destroy();
    }

    const labels = weeklyData.map(day => {
      const date = new Date(day.date);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    });

    const scores = weeklyData.map(day => day.data.score || 0);

    this.charts.productivity = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Productivity Score',
          data: scores,
          borderColor: 'rgb(102, 126, 234)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgb(102, 126, 234)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              color: '#6b7280'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#6b7280'
            }
          }
        },
        animation: {
          duration: 2000,
          easing: 'easeInOutQuart'
        }
      }
    });
  }

  async updateTimeDistributionChart() {
    const ctx = document.getElementById('timeChart').getContext('2d');
    
    if (this.charts.timeDistribution) {
      this.charts.timeDistribution.destroy();
    }

    // Get today's data and calculate time distribution
    try {
      const todayStats = await this.sendMessageWithTimeout({ action: 'getTodayStats' });
      
      // Get productive sites dynamically from storage
      const productiveSites = await this.getProductiveSitesForStats();
      const distractingSites = ['youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'reddit.com'];
      
      let productiveTime = 0;
      let distractingTime = 0;
      let totalTime = 0;
      
      for (const [domain, data] of Object.entries(todayStats)) {
        totalTime += data.timeSpent;
        
        if (productiveSites.some(site => domain.includes(site))) {
          productiveTime += data.timeSpent;
        } else if (distractingSites.some(site => domain.includes(site))) {
          distractingTime += data.timeSpent;
        }
      }
      
      const neutralTime = totalTime - productiveTime - distractingTime;
      
      // Convert to percentages and ensure we have some data to show
      let data, labels;
      if (totalTime > 0) {
        const productivePercent = Math.round((productiveTime / totalTime) * 100);
        const distractingPercent = Math.round((distractingTime / totalTime) * 100);
        const neutralPercent = Math.round((neutralTime / totalTime) * 100);
        
        data = [productivePercent, neutralPercent, distractingPercent];
        labels = ['Productive', 'Neutral', 'Distracting'];
      } else {
        // Show placeholder data when no browsing data exists
        data = [33, 34, 33];
        labels = ['Productive (0%)', 'Neutral (0%)', 'Distracting (0%)'];
      }
      
      const colors = ['#4ade80', '#f59e0b', '#ef4444'];

      this.charts.timeDistribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 20,
                color: '#6b7280'
              }
            }
          },
          animation: {
            animateRotate: true,
            duration: 2000
          }
        }
      });
    } catch (error) {
      console.error('Error updating time distribution chart:', error);
      
      // Fallback to placeholder data
      const data = [33, 34, 33];
      const labels = ['Productive', 'Neutral', 'Distracting'];
      const colors = ['#4ade80', '#f59e0b', '#ef4444'];

      this.charts.timeDistribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 20,
                color: '#6b7280'
              }
            }
          },
          animation: {
            animateRotate: true,
            duration: 2000
          }
        }
      });
    }
  }

  async updateInsights() {
    try {
      // Get today's stats and weekly data for insights
      const todayStats = await this.sendMessageWithTimeout({ action: 'getTodayStats' });
      const weeklyData = await this.sendMessageWithTimeout({ action: 'getWeeklyReport' });
      
      const insights = [];
      
      // Insight 1: Productivity trend
      if (weeklyData && weeklyData.length >= 2) {
        const todayScore = weeklyData[weeklyData.length - 1].data.score || 0;
        const yesterdayScore = weeklyData[weeklyData.length - 2].data.score || 0;
        const diff = todayScore - yesterdayScore;
        
        if (diff > 5) {
          insights.push({
            icon: 'fas fa-chart-line',
            text: `Great! Your productivity improved by ${diff} points compared to yesterday!`
          });
        } else if (diff < -5) {
          insights.push({
            icon: 'fas fa-chart-line',
            text: `Your productivity decreased by ${Math.abs(diff)} points. Try some focus sessions!`
          });
        } else {
          insights.push({
            icon: 'fas fa-chart-line',
            text: 'Your productivity is staying consistent. Keep up the good work!'
          });
        }
      } else {
        insights.push({
          icon: 'fas fa-chart-line',
          text: 'Start browsing to track your productivity trends over time.'
        });
      }
      
      // Insight 2: Top site usage
      if (Object.keys(todayStats).length > 0) {
        const topSites = Object.entries(todayStats)
          .sort(([,a], [,b]) => b.timeSpent - a.timeSpent)
          .slice(0, 1);
        
        if (topSites.length > 0) {
          const [domain, data] = topSites[0];
          const hours = Math.floor(data.timeSpent / (1000 * 60 * 60));
          const minutes = Math.floor((data.timeSpent % (1000 * 60 * 60)) / (1000 * 60));
          
          if (hours > 0) {
            insights.push({
              icon: 'fas fa-clock',
              text: `You spent ${hours}h ${minutes}m on ${domain} today.`
            });
          } else if (minutes > 0) {
            insights.push({
              icon: 'fas fa-clock',
              text: `You spent ${minutes}m on ${domain} today.`
            });
          }
        }
      } else {
        insights.push({
          icon: 'fas fa-clock',
          text: 'No browsing data yet today. Start browsing to see insights!'
        });
      }
      
      // Insight 3: Focus recommendation
      const distractingSites = ['youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'reddit.com'];
      let distractingTime = 0;
      let totalTime = 0;
      
      for (const [domain, data] of Object.entries(todayStats)) {
        totalTime += data.timeSpent;
        if (distractingSites.some(site => domain.includes(site))) {
          distractingTime += data.timeSpent;
        }
      }
      
      if (totalTime > 0) {
        const distractingPercent = Math.round((distractingTime / totalTime) * 100);
        if (distractingPercent > 30) {
          insights.push({
            icon: 'fas fa-target',
            text: `${distractingPercent}% of time on distracting sites. Try a focus session!`
          });
        } else if (distractingPercent > 0) {
          insights.push({
            icon: 'fas fa-target',
            text: `Only ${distractingPercent}% on distracting sites. Excellent focus!`
          });
        } else {
          insights.push({
            icon: 'fas fa-target',
            text: 'Perfect! No time wasted on distracting sites today.'
          });
        }
      } else {
        insights.push({
          icon: 'fas fa-target',
          text: 'Use focus mode to block distracting sites while working!'
        });
      }

      const container = document.getElementById('insightsList');
      if (container) {
        container.innerHTML = insights.map(insight => `
          <div class="insight-item">
            <div class="insight-icon">
              <i class="${insight.icon}"></i>
            </div>
            <div class="insight-text">${insight.text}</div>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Error updating insights:', error);
      
      // Fallback insights
      const defaultInsights = [
        {
          icon: 'fas fa-chart-line',
          text: 'Start browsing to see productivity insights!'
        },
        {
          icon: 'fas fa-clock',
          text: 'Track your time across different websites automatically.'
        },
        {
          icon: 'fas fa-target',
          text: 'Use focus sessions to boost your productivity!'
        }
      ];

      const container = document.getElementById('insightsList');
      if (container) {
        container.innerHTML = defaultInsights.map(insight => `
          <div class="insight-item">
            <div class="insight-icon">
              <i class="${insight.icon}"></i>
            </div>
            <div class="insight-text">${insight.text}</div>
          </div>
        `).join('');
      }
    }
  }

  // Utility Functions
  setupPeriodicUpdates() {
    // Update dashboard every 30 seconds
    setInterval(() => {
      if (this.currentTab === 'dashboard') {
        this.loadDashboardData();
      }
    }, 30000);
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      animation: slideInRight 0.3s ease;
      background: ${type === 'success' ? '#22c55e' : '#ef4444'};
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }

  // === PRODUCTIVE SITES MANAGEMENT ===
  
  async addProductiveSite() {
    const input = document.getElementById('productiveSiteInput');
    if (!input) {
      console.warn('Productive site input not found');
      return;
    }

    const site = input.value.trim().toLowerCase();
    if (!site) {
      this.showError('Please enter a website URL');
      return;
    }

    // Clean up the input
    const cleanSite = site.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    
    try {
      // Check if background script is available
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome runtime not available');
      }

      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'addProductiveSite', site: cleanSite }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || 'Failed to add productive site'));
          }
        });
      });

      input.value = '';
      this.loadProductiveSites();
      this.showSuccess(`${cleanSite} added to productive sites!`);
    } catch (error) {
      console.error('Error adding productive site:', error);
      
      // Show specific error message based on the error type
      if (error.message.includes('Could not establish connection')) {
        this.showError('Extension needs to be reloaded. Please reload the extension from chrome://extensions/');
      } else if (error.message.includes('Chrome runtime not available')) {
        this.showError('Chrome extension runtime is not available. Please reload the page.');
      } else {
        this.showError(`Failed to add productive site: ${error.message}`);
      }
    }
  }

  async loadProductiveSites() {
    try {
      // Check if background script is available
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        console.warn('Chrome runtime not available, skipping productive sites load');
        return;
      }

      const productiveSites = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getProductiveSites' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || []);
          }
        });
      });
      
      this.updateProductiveSitesList(productiveSites);
    } catch (error) {
      console.error('Error loading productive sites:', error);
      
      // Show empty state instead of error to user
      this.updateProductiveSitesList([]);
      
      // Only show error if it's a connection issue
      if (error.message.includes('Could not establish connection')) {
        console.warn('Extension background script not available. Please reload the extension.');
      }
    }
  }

  updateProductiveSitesList(sites) {
    const container = document.getElementById('productiveSitesList');
    
    if (!container) {
      console.warn('Productive sites list container not found');
      return;
    }
    
    if (!sites || sites.length === 0) {
      container.innerHTML = `
        <div class="no-data">
          <i class="fas fa-rocket"></i>
          <p>No productive sites added yet.<br>Add sites that help boost your productivity!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sites.map((site, index) => `
      <div class="productive-site-item" data-site="${site}">
        <div class="productive-site-info">
          <div class="productive-site-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#059669" stroke-width="2"/>
              <path d="M9 12l2 2 4-4" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="productive-site-details">
            <div class="productive-site-url">${site}</div>
            <div class="productive-site-note">🚀 Productive site</div>
          </div>
        </div>
        <button class="remove-productive-site" data-site="${site}" title="Remove from productive sites">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');

    this.setupProductiveRemoveButtons();
  }

  setupProductiveRemoveButtons() {
    document.querySelectorAll('#productiveSitesList .remove-productive-site').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const site = button.getAttribute('data-site');
        if (site) {
          this.confirmAndRemoveProductiveSite(site, button);
        }
      });
    });
  }

  async confirmAndRemoveProductiveSite(site, buttonElement) {
    if (!confirm(`Remove "${site}" from productive sites?`)) {
      return;
    }

    try {
      // Check if background script is available
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        throw new Error('Chrome runtime not available');
      }

      // Optimistic UI update
      const siteItem = buttonElement.closest('.productive-site-item');
      if (siteItem) {
        siteItem.style.opacity = '0.5';
        buttonElement.disabled = true;
      }

      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'removeProductiveSite', site }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || 'Failed to remove productive site'));
          }
        });
      });

      this.loadProductiveSites();
      this.showSuccess(`Removed "${site}" from productive sites`);
    } catch (error) {
      console.error('Error removing productive site:', error);
      
      // Restore UI state on error
      const siteItem = buttonElement.closest('.productive-site-item');
      if (siteItem) {
        siteItem.style.opacity = '1';
        buttonElement.disabled = false;
      }
      
      if (error.message.includes('Could not establish connection')) {
        this.showError('Extension needs to be reloaded. Please reload the extension from chrome://extensions/');
      } else {
        this.showError(`Failed to remove productive site: ${error.message}`);
      }
    }
  }
}

// Initialize popup
const popup = new ProductivityPopup();

// Make popup available globally for HTML onclick handlers
window.popup = popup;
