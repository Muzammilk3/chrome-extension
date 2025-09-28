// Content Script - Injected into web pages
class ContentTracker {
  constructor() {
    this.pageStartTime = Date.now();
    this.isVisible = true;
    this.activityTimeout = null;
    this.lastActivity = Date.now();
    
    // Check for immediate blocking first
    this.checkBlockingStatus();
    
    this.init();
  }

  async checkBlockingStatus() {
    try {
      // Send a message to background to check if this site should be blocked
      const response = await chrome.runtime.sendMessage({
        action: 'checkSiteBlocked',
        url: window.location.href
      });
      
      if (response && response.blocked) {
        // Immediately redirect to blocked page
        const blockedUrl = chrome.runtime.getURL('blocked.html') + 
          `?site=${encodeURIComponent(window.location.hostname)}&original=${encodeURIComponent(window.location.href)}`;
        window.location.replace(blockedUrl);
        return;
      }
    } catch (error) {
      // Continue with normal tracking if check fails
      console.log('Block check failed:', error);
    }
  }

  init() {
    // Track page visibility
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (this.isVisible) {
        this.pageStartTime = Date.now();
      } else {
        this.sendTimeUpdate();
      }
    });

    // Track user activity (mouse, keyboard, scroll)
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        this.updateLastActivity();
      }, { passive: true });
    });

    // Send periodic updates
    setInterval(() => {
      if (this.isVisible && this.isActiveRecently()) {
        this.sendTimeUpdate();
      }
    }, 30000); // Every 30 seconds

    // Send final update when leaving page
    window.addEventListener('beforeunload', () => {
      this.sendTimeUpdate();
    });

    // Track focus sessions
    this.trackFocusSession();
  }

  updateLastActivity() {
    this.lastActivity = Date.now();
    
    // Clear timeout and set new one
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }
    
    // Consider inactive after 5 minutes of no activity
    this.activityTimeout = setTimeout(() => {
      this.isVisible = false;
    }, 5 * 60 * 1000);
  }

  isActiveRecently() {
    return Date.now() - this.lastActivity < 5 * 60 * 1000; // 5 minutes
  }

  sendTimeUpdate() {
    if (this.pageStartTime) {
      const timeSpent = Date.now() - this.pageStartTime;
      
      // Add error handling for message sending
      try {
        chrome.runtime.sendMessage({
          action: 'recordTime',
          data: {
            url: window.location.href,
            timeSpent: timeSpent,
            timestamp: Date.now()
          }
        }, (response) => {
          // Handle response or error
          if (chrome.runtime.lastError) {
            console.log('Content script message error:', chrome.runtime.lastError.message);
          }
        });
      } catch (error) {
        console.log('Content script error:', error);
      }
      
      this.pageStartTime = Date.now();
    }
  }

  trackFocusSession() {
    // Check if we're in a focus session
    try {
      chrome.runtime.sendMessage({ action: 'getFocusStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Focus status error:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.active) {
          this.showFocusIndicator();
        }
      });
    } catch (error) {
      console.log('Focus session tracking error:', error);
    }
  }

  showFocusIndicator() {
    // Create focus mode indicator
    const indicator = document.createElement('div');
    indicator.id = 'productivity-focus-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      animation: focusPulse 2s infinite;
      backdrop-filter: blur(10px);
    `;
    
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; background: #4ade80; border-radius: 50%; animation: pulse 1s infinite;"></div>
        Focus Mode Active
      </div>
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes focusPulse {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(indicator);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.remove();
      }
      if (style.parentNode) {
        style.remove();
      }
    }, 5000);
  }
}

// Initialize content tracker
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ContentTracker());
} else {
  new ContentTracker();
}
