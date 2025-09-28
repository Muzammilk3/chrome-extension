// Background Service Worker - Core functionality
class ProductivityTracker {
  constructor() {
    this.activeTab = null;
    this.startTime = null;
    this.sessionData = {};
    this.blockedSites = [];
    this.focusMode = false;
    this.user = null;
    this.API_BASE = 'http://localhost:5000/api';
    this.updatingRules = false; // Flag to prevent concurrent rule updates
    this.ruleUpdateTimeout = null; // For throttling rule updates
    
    this.init();
  }

  async init() {
    // Load user data and preferences
    await this.loadUserData();
    await this.loadBlockedSites();
    
    // Set up event listeners
    this.setupListeners();
    
    // Start tracking
    this.startTracking();
    
    // Set up daily report generation
    this.setupDailyReports();
    
    console.log('Focus Extension initialized successfully');
    console.log('Current blocked sites:', this.blockedSites);
  }

  setupListeners() {
    // Tab activation listener
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      await this.handleTabChange(activeInfo.tabId);
    });

    // Tab update listener (URL changes) - trigger on loading for immediate blocking
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'loading' && tab.url) {
        // Check for immediate blocking when page starts loading
        if (await this.isSiteBlocked(tab.url)) {
          await this.blockSite(tabId, tab.url);
          return;
        }
      }
      
      if (changeInfo.status === 'complete' && tab.url) {
        await this.handleTabChange(tabId, tab.url);
      }
    });

    // Web navigation listener for even faster blocking
    chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
      if (details.frameId === 0) { // Main frame only
        if (await this.isSiteBlocked(details.url)) {
          await this.blockSite(details.tabId, details.url);
        }
      }
    });

    // Additional listener for navigation committed (even faster)
    chrome.webNavigation.onCommitted.addListener(async (details) => {
      if (details.frameId === 0) { // Main frame only
        if (await this.isSiteBlocked(details.url)) {
          await this.blockSite(details.tabId, details.url);
        }
      }
    });

    // Window focus listener
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        this.handleWindowBlur();
      } else {
        const tabs = await chrome.tabs.query({ active: true, windowId });
        if (tabs[0]) {
          await this.handleTabChange(tabs[0].id, tabs[0].url);
        }
      }
    });

    // Extension messages
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Handle message asynchronously
      this.handleMessage(request, sender, sendResponse)
        .catch(error => {
          console.error('Message handling error:', error);
          sendResponse({ error: error.message });
        });
      
      return true; // Keep message channel open for async response
    });

    // Alarm listener for periodic saves
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'saveData') {
        this.saveCurrentSession();
      } else if (alarm.name === 'dailyReport') {
        this.generateDailyReport();
      } else if (alarm.name === 'endFocus') {
        console.log('Focus session ended by alarm');
        this.stopFocusMode();
      }
    });
  }

  async handleTabChange(tabId, url = null) {
    // Save current session data
    if (this.activeTab && this.startTime) {
      await this.saveTimeSpent();
    }

    // Get tab info if URL not provided
    if (!url) {
      try {
        const tab = await chrome.tabs.get(tabId);
        url = tab.url;
      } catch (error) {
        console.log('Could not get tab info:', error);
        return;
      }
    }

    // Check if site is blocked
    if (await this.isSiteBlocked(url)) {
      await this.blockSite(tabId, url);
      return;
    }

    // Start tracking new site
    this.activeTab = {
      id: tabId,
      url: url,
      domain: this.extractDomain(url)
    };
    this.startTime = Date.now();
  }

  async handleWindowBlur() {
    if (this.activeTab && this.startTime) {
      await this.saveTimeSpent();
      this.activeTab = null;
      this.startTime = null;
    }
  }

  async saveTimeSpent() {
    if (!this.activeTab || !this.startTime) return;

    const timeSpent = Date.now() - this.startTime;
    const domain = this.activeTab.domain;
    
    if (timeSpent < 1000) return; // Ignore very short visits

    // Get today's date
    const today = new Date().toDateString();
    
    // Load existing data
    const result = await chrome.storage.local.get(['dailyData']);
    let dailyData = result.dailyData || {};
    
    if (!dailyData[today]) {
      dailyData[today] = {};
    }
    
    if (!dailyData[today][domain]) {
      dailyData[today][domain] = {
        timeSpent: 0,
        visits: 0,
        lastVisit: Date.now()
      };
    }
    
    dailyData[today][domain].timeSpent += timeSpent;
    dailyData[today][domain].visits += 1;
    dailyData[today][domain].lastVisit = Date.now();
    
    // Save to local storage
    await chrome.storage.local.set({ dailyData });
    
    // Sync to backend if user is logged in
    if (this.user) {
      await this.syncToBackend(domain, timeSpent);
    }
  }

  async saveCurrentSession() {
    // Save the current session data
    await this.saveTimeSpent();
    
    // Additional session saving logic can be added here
    console.log('Current session saved');
  }

  async syncToBackend(domain, timeSpent) {
    try {
      const response = await fetch(`${this.API_BASE}/tracking/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.user.token}`
        },
        body: JSON.stringify({
          domain,
          timeSpent,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.log('Sync error:', error);
    }
  }

  async isSiteBlocked(url) {
    if (!url) return false;
    
    const domain = this.extractDomain(url);
    if (!domain) return false;
    
    console.log('Checking if site is blocked:', domain);
    console.log('Current blocked sites:', this.blockedSites);
    console.log('Focus mode active:', this.focusMode);
    
    // Skip checking internal chrome pages and extension pages
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return false;
    }
    
    // Check permanent blocked sites
    if (this.blockedSites && this.blockedSites.length > 0) {
      const isBlocked = this.blockedSites.some(site => {
        const normalizedSite = site.toLowerCase().replace(/^www\./, '');
        const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
        return normalizedDomain.includes(normalizedSite) || normalizedSite.includes(normalizedDomain);
      });
      
      if (isBlocked) {
        console.log('Site blocked by permanent block list:', domain);
        return true;
      }
    }
    
    // Check focus mode
    if (this.focusMode) {
      const focusData = await chrome.storage.local.get(['focusSession']);
      if (focusData.focusSession && focusData.focusSession.active) {
        const focusSites = focusData.focusSession.blockedSites || [];
        if (focusSites.some(site => domain.includes(site))) {
          console.log('Site blocked by focus session:', domain);
          return true;
        }
      }
    }
    
    return false;
  }

  async blockSite(tabId, url) {
    console.log('Blocking site - TabID:', tabId, 'URL:', url);
    
    const domain = this.extractDomain(url);
    console.log('Extracted domain:', domain);
    
    const blockedPageUrl = chrome.runtime.getURL('blocked.html') + 
                          `?site=${encodeURIComponent(domain)}`;
    
    console.log('Redirecting to blocked page:', blockedPageUrl);
    
    try {
      await chrome.tabs.update(tabId, { url: blockedPageUrl });
      console.log('Successfully redirected to blocked page');
    } catch (error) {
      console.error('Error blocking site:', error);
    }
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getTodayStats':
          sendResponse(await this.getTodayStats());
          break;
          
        case 'startFocusMode':
          await this.startFocusMode(request.duration, request.blockedSites);
          sendResponse({ success: true });
          break;
          
        case 'stopFocusMode':
          await this.stopFocusMode();
          sendResponse({ success: true });
          break;
          
        case 'getFocusStatus':
          sendResponse(await this.getFocusStatus());
          break;
          
        case 'addBlockedSite':
          console.log('Received addBlockedSite message for:', request.site);
          await this.addBlockedSite(request.site);
          sendResponse({ success: true });
          break;
          
        case 'removeBlockedSite':
          await this.removeBlockedSite(request.site);
          sendResponse({ success: true });
          break;
          
        case 'getBlockedSites':
          sendResponse(await this.getBlockedSites());
          break;
          
        case 'addFocusBlockedSite':
          console.log('Received addFocusBlockedSite message for:', request.site);
          await this.addFocusBlockedSite(request.site);
          sendResponse({ success: true });
          break;
          
        case 'removeFocusBlockedSite':
          await this.removeFocusBlockedSite(request.site);
          sendResponse({ success: true });
          break;
          
        case 'getFocusBlockedSites':
          sendResponse(await this.getFocusBlockedSites());
          break;
          
        case 'addProductiveSite':
          console.log('Received addProductiveSite message for:', request.site);
          await this.addProductiveSite(request.site);
          sendResponse({ success: true });
          break;
          
        case 'removeProductiveSite':
          await this.removeProductiveSite(request.site);
          sendResponse({ success: true });
          break;
          
        case 'getProductiveSites':
          sendResponse(await this.getProductiveSites());
          break;
          
        case 'checkSiteBlocked':
          const isBlocked = await this.isSiteBlocked(request.url);
          sendResponse({ blocked: isBlocked });
          break;
          
        case 'login':
          sendResponse(await this.handleLogin(request.credentials));
          break;
          
        case 'register':
          sendResponse(await this.handleRegister(request.userData));
          break;
          
        case 'googleAuth':
          sendResponse(await this.handleGoogleAuth(request.token));
          break;
          
        case 'logout':
          await this.handleLogout();
          sendResponse({ success: true });
          break;
          
        case 'getWeeklyReport':
          sendResponse(await this.getWeeklyReport());
          break;
        case 'createTestData':
          sendResponse(await this.createTestData());
          break;
          
        case 'getProductivityScore':
          sendResponse(await this.getProductivityScore());
          break;
          
        default:
          console.warn('Unknown action:', request.action);
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async getTodayStats() {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['dailyData']);
    const dailyData = result.dailyData || {};
    
    return dailyData[today] || {};
  }

  async startFocusMode(duration, blockedSites) {
    this.focusMode = true;
    const endTime = Date.now() + (duration * 60 * 1000);
    
    await chrome.storage.local.set({
      focusSession: {
        active: true,
        startTime: Date.now(),
        endTime: endTime,
        blockedSites: blockedSites || []
      }
    });
    
    // Update blocking rules for immediate blocking (throttled)
    this.throttledUpdateBlockingRules();
    
    // Set alarm to end focus mode
    chrome.alarms.create('endFocus', { when: endTime });
    
    // Update badge
    chrome.action.setBadgeText({ text: 'FOCUS' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
  }

  async stopFocusMode() {
    this.focusMode = false;
    
    await chrome.storage.local.set({
      focusSession: { active: false }
    });
    
    console.log('Focus mode stopped - removing blocking rules');
    
    // Update blocking rules immediately to remove focus session blocks
    await this.updateBlockingRules();
    
    // Refresh all tabs that might be showing blocked pages
    setTimeout(async () => {
      try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.url && tab.url.includes(chrome.runtime.getURL('blocked.html'))) {
            console.log('Refreshing previously blocked tab:', tab.id);
            chrome.tabs.reload(tab.id);
          }
        }
      } catch (error) {
        console.error('Error refreshing tabs:', error);
      }
    }, 1000); // Wait 1 second for rules to be updated
    
    chrome.alarms.clear('endFocus');
    chrome.action.setBadgeText({ text: '' });
    
    // Show notification that focus mode ended
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/activity-tracker.png',
        title: 'Focus Session Ended',
        message: 'Your focus session has ended. Sites are now unblocked!'
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }

    // Refresh all active tabs to remove any blocking
    try {
      const tabs = await chrome.tabs.query({ active: true });
      tabs.forEach(tab => {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          chrome.tabs.reload(tab.id).catch(err => console.log('Could not reload tab:', err));
        }
      });
    } catch (error) {
      console.error('Error refreshing tabs:', error);
    }
  }

  async getFocusStatus() {
    try {
      const result = await chrome.storage.local.get(['focusSession']);
      return result.focusSession || { active: false };
    } catch (error) {
      console.error('Error getting focus status:', error);
      return { active: false };
    }
  }

  async getFocusBlockedSites() {
    try {
      const result = await chrome.storage.local.get(['focusBlockedSites']);
      return result.focusBlockedSites || [];
    } catch (error) {
      console.error('Error getting focus blocked sites:', error);
      return [];
    }
  }

  async addFocusBlockedSite(site) {
    console.log('Adding focus blocked site:', site);
    
    try {
      const result = await chrome.storage.local.get(['focusBlockedSites']);
      let focusBlockedSites = result.focusBlockedSites || [];
      
      console.log('Current focus blocked sites before adding:', focusBlockedSites);
      
      if (!focusBlockedSites.includes(site)) {
        focusBlockedSites.push(site);
        await chrome.storage.local.set({ focusBlockedSites });
        console.log('Focus blocked site added! New list:', focusBlockedSites);
      } else {
        console.log('Focus blocked site already in list');
      }
    } catch (error) {
      console.error('Error adding focus blocked site:', error);
      throw error;
    }
  }

  async removeFocusBlockedSite(site) {
    console.log('Removing focus blocked site:', site);
    
    try {
      const result = await chrome.storage.local.get(['focusBlockedSites']);
      let focusBlockedSites = result.focusBlockedSites || [];
      
      const index = focusBlockedSites.indexOf(site);
      if (index > -1) {
        focusBlockedSites.splice(index, 1);
        await chrome.storage.local.set({ focusBlockedSites });
        console.log('Focus blocked site removed! New list:', focusBlockedSites);
      }
    } catch (error) {
      console.error('Error removing focus blocked site:', error);
      throw error;
    }
  }

  async addBlockedSite(site) {
    console.log('Adding blocked site:', site);
    
    const result = await chrome.storage.local.get(['blockedSites']);
    let blockedSites = result.blockedSites || [];
    
    console.log('Current blocked sites before adding:', blockedSites);
    
    if (!blockedSites.includes(site)) {
      blockedSites.push(site);
      await chrome.storage.local.set({ blockedSites });
      this.blockedSites = blockedSites;
      
      console.log('Site added! New blocked sites list:', blockedSites);
      
      // Update declarativeNetRequest rules for instant blocking (throttled)
      this.throttledUpdateBlockingRules();
      
      // Sync to backend
      if (this.user) {
        await this.syncBlockedSitesToBackend();
      }
    } else {
      console.log('Site already in blocked list');
    }
  }

  async removeBlockedSite(site) {
    const result = await chrome.storage.local.get(['blockedSites']);
    let blockedSites = result.blockedSites || [];
    
    blockedSites = blockedSites.filter(s => s !== site);
    await chrome.storage.local.set({ blockedSites });
    this.blockedSites = blockedSites;
    
    // Update declarativeNetRequest rules for instant blocking (throttled)
    this.throttledUpdateBlockingRules();
    
    // Sync to backend
    if (this.user) {
      await this.syncBlockedSitesToBackend();
    }
  }

  async getBlockedSites() {
    const result = await chrome.storage.local.get(['blockedSites']);
    return result.blockedSites || [];
  }

  async handleLogin(credentials) {
    try {
      const response = await fetch(`${this.API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.user = data.user;
        await chrome.storage.local.set({ user: data.user });
        
        // Sync local data to backend
        await this.syncLocalDataToBackend();
        
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      return { success: false, error: 'Connection failed' };
    }
  }

  async handleRegister(userData) {
    try {
      const response = await fetch(`${this.API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.user = data.user;
        await chrome.storage.local.set({ user: data.user });
        
        // Sync local data to backend
        await this.syncLocalDataToBackend();
        
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error || data.message || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Connection failed' };
    }
  }

  async handleLogout() {
    this.user = null;
    await chrome.storage.local.remove(['user']);
  }

  async handleGoogleAuth(token) {
    try {
      // Get user info from Google using the token
      const userInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`);
      
      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error('Google API error:', errorText);
        return { success: false, error: 'Failed to get user info from Google. Please try again.' };
      }
      
      const googleUser = await userInfoResponse.json();
      
      if (!googleUser.id) {
        console.error('Google user data:', googleUser);
        return { success: false, error: 'Invalid response from Google. Please try again.' };
      }

      console.log('Google user data received:', { id: googleUser.id, email: googleUser.email, name: googleUser.name });

      // Send Google user data to backend for verification and user creation/login
      const response = await fetch(`${this.API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          googleId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend auth error:', response.status, errorText);
        return { success: false, error: `Authentication failed: ${response.status}` };
      }

      const data = await response.json();
      
      if (data.success) {
        this.user = data.user;
        await chrome.storage.local.set({ user: data.user });
        
        // Sync local data to backend
        await this.syncLocalDataToBackend();
        
        return { success: true, user: data.user };
      } else {
        console.error('Backend auth error:', data);
        return { success: false, error: data.error || 'Google authentication failed' };
      }
    } catch (error) {
      console.error('Google auth error:', error);
      const errorMessage = error.message || error.toString();
      return { success: false, error: `Google authentication failed: ${errorMessage}` };
    }
  }

  async syncLocalDataToBackend() {
    // Sync blocked sites
    await this.syncBlockedSitesToBackend();
    
    // Sync daily data
    const result = await chrome.storage.local.get(['dailyData']);
    if (result.dailyData) {
      try {
        await fetch(`${this.API_BASE}/tracking/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.user.token}`
          },
          body: JSON.stringify({ dailyData: result.dailyData })
        });
      } catch (error) {
        console.log('Sync error:', error);
      }
    }
  }

  async syncBlockedSitesToBackend() {
    try {
      await fetch(`${this.API_BASE}/users/blocked-sites`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.user.token}`
        },
        body: JSON.stringify({ blockedSites: this.blockedSites })
      });
    } catch (error) {
      console.log('Sync error:', error);
    }
  }

  async loadUserData() {
    const result = await chrome.storage.local.get(['user']);
    this.user = result.user || null;
  }

  async loadBlockedSites() {
    const result = await chrome.storage.local.get(['blockedSites']);
    this.blockedSites = result.blockedSites || [];
    
    // Update blocking rules when sites are loaded (throttled)
    this.throttledUpdateBlockingRules();
  }

  // Throttled version to prevent rapid successive calls
  throttledUpdateBlockingRules() {
    if (this.ruleUpdateTimeout) {
      clearTimeout(this.ruleUpdateTimeout);
    }
    
    this.ruleUpdateTimeout = setTimeout(async () => {
      await this.updateBlockingRules();
    }, 300); // Wait 300ms before updating rules
  }

  async updateBlockingRules() {
    try {
      // Prevent concurrent updates
      if (this.updatingRules) {
        console.log('Blocking rules update already in progress, skipping...');
        return;
      }
      this.updatingRules = true;

      // Get current rules to remove them
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIdsToRemove = existingRules.map(rule => rule.id);

      // Always remove all existing rules first
      if (ruleIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIdsToRemove
        });
        console.log('Removed', ruleIdsToRemove.length, 'existing rules');
      }

      // Create new rules for blocked sites
      const newRules = [];
      let ruleId = 1000; // Start with a higher number to avoid conflicts

      // Add rules for permanently blocked sites
      if (this.blockedSites && this.blockedSites.length > 0) {
        console.log('Adding permanent blocked sites:', this.blockedSites);
        for (const site of this.blockedSites) {
          newRules.push({
            id: ruleId++,
            priority: 1,
            action: {
              type: "redirect",
              redirect: {
                url: chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}`)
              }
            },
            condition: {
              urlFilter: `*://*.${site}/*`,
              resourceTypes: ["main_frame"]
            }
          });
          
          // Also add rule for www subdomain if not already included
          if (!site.startsWith('www.')) {
            newRules.push({
              id: ruleId++,
              priority: 1,
              action: {
                type: "redirect",
                redirect: {
                  url: chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}`)
                }
              },
              condition: {
                urlFilter: `*://www.${site}/*`,
                resourceTypes: ["main_frame"]
              }
            });
          }
        }
      }

      // Add rules for focus session blocked sites
      const focusData = await chrome.storage.local.get(['focusSession']);
      console.log('Focus session data:', focusData.focusSession);
      
      if (focusData.focusSession && focusData.focusSession.active && focusData.focusSession.blockedSites) {
        console.log('Adding focus session blocked sites:', focusData.focusSession.blockedSites);
        for (const site of focusData.focusSession.blockedSites) {
          // Only add if not already in permanent blocked sites to avoid duplicates
          if (!this.blockedSites.includes(site)) {
            console.log('Adding focus rule for:', site);
            newRules.push({
              id: ruleId++,
              priority: 2,
              action: {
                type: "redirect",
                redirect: {
                  url: chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}`)
                }
              },
              condition: {
                urlFilter: `*://*.${site}/*`,
                resourceTypes: ["main_frame"]
              }
            });
            
            // Also add rule for www subdomain if not already included
            if (!site.startsWith('www.')) {
              newRules.push({
                id: ruleId++,
                priority: 2,
                action: {
                  type: "redirect",
                  redirect: {
                    url: chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}`)
                  }
                },
                condition: {
                  urlFilter: `*://www.${site}/*`,
                  resourceTypes: ["main_frame"]
                }
              });
            }
          }
        }
      } else {
        console.log('Focus session is not active - no focus rules added');
      }

      // Add new rules if any
      if (newRules.length > 0) {
        console.log('Adding rules:', newRules.map(r => ({ id: r.id, site: r.condition.urlFilter })));
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: newRules
        });
        console.log('Added', newRules.length, 'new blocking rules');
      } else {
        console.log('No blocking rules to add');
      }

      console.log('Blocking rules updated successfully');
    } catch (error) {
      console.error('Error updating blocking rules:', error);
      
      // Try to clear all rules if there's an error
      try {
        const allRules = await chrome.declarativeNetRequest.getDynamicRules();
        if (allRules.length > 0) {
          await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: allRules.map(rule => rule.id)
          });
          console.log('Cleared all rules due to error');
        }
      } catch (clearError) {
        console.error('Failed to clear rules after error:', clearError);
      }
    } finally {
      this.updatingRules = false;
    }
  }

  startTracking() {
    // Set up periodic data saving
    chrome.alarms.create('saveData', { periodInMinutes: 1 });
  }

  setupDailyReports() {
    // Set up daily report generation at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    chrome.alarms.create('dailyReport', { when: tomorrow.getTime() });
  }

  async generateDailyReport() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = yesterday.toDateString();
    
    const result = await chrome.storage.local.get(['dailyData']);
    const dailyData = result.dailyData || {};
    
    if (dailyData[dateKey]) {
      // Generate productivity score and insights
      const report = this.calculateProductivityReport(dailyData[dateKey]);
      
      // Save report
      const reportsResult = await chrome.storage.local.get(['reports']);
      let reports = reportsResult.reports || {};
      reports[dateKey] = report;
      
      await chrome.storage.local.set({ reports });
      
      // Sync to backend
      if (this.user) {
        await this.syncReportToBackend(dateKey, report);
      }
      
      // Show notification
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/activity-tracker.png',
          title: 'Daily Productivity Report Ready!',
          message: `Productivity Score: ${report.score}/100`
        });
      } catch (error) {
        console.log('Notification creation failed:', error);
      }
    }
    
    // Schedule next report
    this.setupDailyReports();
  }

  calculateProductivityReport(dayData) {
    const productiveSites = ['github.com', 'stackoverflow.com', 'docs.google.com', 'notion.so'];
    const distractingSites = ['youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'reddit.com'];
    
    let totalTime = 0;
    let productiveTime = 0;
    let distractingTime = 0;
    let topSites = [];
    
    for (const [domain, data] of Object.entries(dayData)) {
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
    
    const productivityRatio = totalTime > 0 ? productiveTime / totalTime : 0;
    const distractionRatio = totalTime > 0 ? distractingTime / totalTime : 0;
    
    let score = Math.max(0, Math.min(100, 
      (productivityRatio * 60) + 
      ((1 - distractionRatio) * 40)
    ));
    
    return {
      score: Math.round(score),
      totalTime,
      productiveTime,
      distractingTime,
      topSites: topSites.slice(0, 10),
      insights: this.generateInsights(productivityRatio, distractionRatio, topSites)
    };
  }

  generateInsights(productivityRatio, distractionRatio, topSites) {
    const insights = [];
    
    if (productivityRatio > 0.6) {
      insights.push("Great job! You spent most of your time on productive activities.");
    } else if (productivityRatio < 0.3) {
      insights.push("Consider focusing more on productive tasks tomorrow.");
    }
    
    if (distractionRatio > 0.4) {
      insights.push("Try to reduce time on distracting websites.");
    }
    
    if (topSites.length > 0) {
      const topSite = topSites[0];
      const hours = Math.floor(topSite.timeSpent / (1000 * 60 * 60));
      const minutes = Math.floor((topSite.timeSpent % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        insights.push(`You spent ${hours}h ${minutes}m on ${topSite.domain}.`);
      } else {
        insights.push(`You spent ${minutes}m on ${topSite.domain}.`);
      }
    }
    
    return insights;
  }

  async getWeeklyReport() {
    // Get daily data from local storage
    const result = await chrome.storage.local.get(['dailyData']);
    const dailyData = result.dailyData || {};
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const weeklyData = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekAgo);
      date.setDate(date.getDate() + i);
      const dateKey = date.toDateString();
      
      // Calculate productivity report for each day
      const dayData = dailyData[dateKey] || {};
      let report;
      
      if (Object.keys(dayData).length > 0) {
        report = this.calculateProductivityReport(dayData);
      } else {
        report = { score: 0, totalTime: 0 };
      }
      
      weeklyData.push({
        date: dateKey,
        data: report
      });
    }
    
    return weeklyData;
  }

  async getProductivityScore() {
    const today = new Date().toDateString();
    const todayStats = await this.getTodayStats();
    
    // Check if no data exists
    if (Object.keys(todayStats).length === 0) {
      // Create some sample data for testing if user wants to see the scoring system
      const sampleData = {
        'github.com': { timeSpent: 3600000, visits: 5, lastVisit: Date.now() }, // 1 hour productive
        'stackoverflow.com': { timeSpent: 1800000, visits: 3, lastVisit: Date.now() }, // 30 min productive  
        'youtube.com': { timeSpent: 900000, visits: 2, lastVisit: Date.now() }, // 15 min distracting
        'docs.google.com': { timeSpent: 2700000, visits: 4, lastVisit: Date.now() } // 45 min productive
      };
      
      // Calculate with sample data to show how scoring works
      const sampleReport = this.calculateProductivityReport(sampleData);
      
      return { 
        score: 0, 
        message: "Visit websites to start tracking! (Example: " + sampleReport.score + "/100 for productive browsing)" 
      };
    }
    
    const report = this.calculateProductivityReport(todayStats);
    return {
      score: report.score,
      message: report.insights[0] || "Keep up the good work!"
    };
  }

  async createTestData() {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(['dailyData']);
    let dailyData = result.dailyData || {};
    
    // Create test data for today
    dailyData[today] = {
      'github.com': { timeSpent: 3600000, visits: 5, lastVisit: Date.now() }, // 1 hour productive
      'stackoverflow.com': { timeSpent: 1800000, visits: 3, lastVisit: Date.now() }, // 30 min productive  
      'youtube.com': { timeSpent: 900000, visits: 2, lastVisit: Date.now() }, // 15 min distracting
      'docs.google.com': { timeSpent: 2700000, visits: 4, lastVisit: Date.now() }, // 45 min productive
      'facebook.com': { timeSpent: 600000, visits: 2, lastVisit: Date.now() }, // 10 min distracting
      'notion.so': { timeSpent: 1200000, visits: 2, lastVisit: Date.now() } // 20 min productive
    };
    
    // Create test data for the past week
    for (let i = 1; i <= 6; i++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - i);
      const dateKey = pastDate.toDateString();
      
      // Vary the data slightly for each day
      const baseScore = 60 + (Math.random() * 30); // Score between 60-90
      const totalTime = 6000000 + (Math.random() * 3000000); // 1.5-2.5 hours total
      
      dailyData[dateKey] = {
        'github.com': { timeSpent: totalTime * 0.4, visits: 3 + Math.floor(Math.random() * 3), lastVisit: Date.now() },
        'stackoverflow.com': { timeSpent: totalTime * 0.2, visits: 2 + Math.floor(Math.random() * 2), lastVisit: Date.now() },
        'youtube.com': { timeSpent: totalTime * 0.15, visits: 1 + Math.floor(Math.random() * 2), lastVisit: Date.now() },
        'docs.google.com': { timeSpent: totalTime * 0.15, visits: 1 + Math.floor(Math.random() * 2), lastVisit: Date.now() },
        'reddit.com': { timeSpent: totalTime * 0.1, visits: 1, lastVisit: Date.now() }
      };
    }
    
    await chrome.storage.local.set({ dailyData });
    return { success: true, message: 'Test data created successfully!' };
  }

  // === PRODUCTIVE SITES MANAGEMENT ===
  
  async getProductiveSites() {
    try {
      const result = await chrome.storage.local.get(['productiveSites']);
      return result.productiveSites || [];
    } catch (error) {
      console.error('Error getting productive sites:', error);
      return [];
    }
  }

  async addProductiveSite(site) {
    console.log('Adding productive site:', site);
    
    try {
      const result = await chrome.storage.local.get(['productiveSites']);
      let productiveSites = result.productiveSites || [];
      
      console.log('Current productive sites before adding:', productiveSites);
      
      if (!productiveSites.includes(site)) {
        productiveSites.push(site);
        await chrome.storage.local.set({ productiveSites });
        console.log('Productive site added! New list:', productiveSites);
      } else {
        console.log('Productive site already in list');
      }
    } catch (error) {
      console.error('Error adding productive site:', error);
      throw error;
    }
  }

  async removeProductiveSite(site) {
    console.log('Removing productive site:', site);
    
    try {
      const result = await chrome.storage.local.get(['productiveSites']);
      let productiveSites = result.productiveSites || [];
      
      const index = productiveSites.indexOf(site);
      if (index > -1) {
        productiveSites.splice(index, 1);
        await chrome.storage.local.set({ productiveSites });
        console.log('Productive site removed! New list:', productiveSites);
      }
    } catch (error) {
      console.error('Error removing productive site:', error);
      throw error;
    }
  }
}

// Initialize the tracker and make it globally available
const productivityTracker = new ProductivityTracker();

// === Ad Blocker Feature ===
const AD_BLOCK_RULESET_ID = 'blocking_rules';

// Listen for ad blocker toggle changes
chrome.storage.local.get(['adBlockerEnabled'], (result) => {
  if (result.adBlockerEnabled) {
    chrome.declarativeNetRequest.updateEnabledRulesets({enableRulesetIds: [AD_BLOCK_RULESET_ID]});
  } else {
    chrome.declarativeNetRequest.updateEnabledRulesets({disableRulesetIds: [AD_BLOCK_RULESET_ID]});
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.adBlockerEnabled) {
    if (changes.adBlockerEnabled.newValue) {
      chrome.declarativeNetRequest.updateEnabledRulesets({enableRulesetIds: [AD_BLOCK_RULESET_ID]});
    } else {
      chrome.declarativeNetRequest.updateEnabledRulesets({disableRulesetIds: [AD_BLOCK_RULESET_ID]});
    }
  }
});

// Log blocked ad requests for debugging (defensive check)
if (
  chrome.declarativeNetRequest &&
  chrome.declarativeNetRequest.onRuleMatchedDebug &&
  typeof chrome.declarativeNetRequest.onRuleMatchedDebug.addListener === 'function'
) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    if (info.rule && info.rule.ruleId && info.request && info.request.url) {
      console.log('[AdBlocker] Blocked:', info.request.url, 'by rule', info.rule.ruleId);
    }
  });
} else {
  console.warn('declarativeNetRequest.onRuleMatchedDebug is not available in this context or missing permissions.');
}
