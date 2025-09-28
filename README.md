# ProductivityTracker Pro

An advanced Chrome extension for tracking productivity, blocking distracting sites, and visualizing your browsing analytics.

## Features
- **Dashboard:** View your productivity score and top sites for today.
- **Focus Mode:** Temporarily block distracting sites and set focus sessions with timers.
- **Site Blocking:** Permanently block specific sites and quickly add popular distracting sites.
- **Productive Sites:** Mark sites that help you stay productive.
- **Ads Blocker:** Toggle ad blocking for common ad domains with a simple switch.
- **Reports:** Visualize productivity trends and time distribution with charts.
- **Notifications:** Get reminders and feedback directly in the browser.

## Installation
1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the `extension` folder.

## Usage
- Click the extension icon to open the popup.
- Navigate between tabs: Dashboard, Focus, Blocking, Productive Sites, Ads Blocker, Reports.
- Use the toggle switches and buttons to block/unblock sites and enable ad blocking.
- View your productivity analytics and insights in the Reports tab.

## Backend (Optional)
If you want to run the backend server for advanced features:
1. Navigate to the `backend` folder.
2. Run `npm install` to install dependencies.
3. Start the server with `node server.js`.
4. The backend will run on `http://localhost:5000`.

## Project Structure
- `extension/` — Chrome extension source code
- `backend/` — Optional Node.js/Express backend
- `README.md` — Project documentation

## Support & Questions
For troubleshooting, see the extension popup or contact:
- **Email:** muzammilahmedk3@gmail.com
- **GitHub:** [Muzammilk3](https://github.com/Muzammilk3)

## How to Run This Project

### Chrome Extension
1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select the `extension` folder
4. Pin the extension to your toolbar

### Backend (Optional)
1. Open a terminal and navigate to the `backend` folder
2. Run:
   ```sh
   npm install
   node server.js
   ```
3. The backend will run on `http://localhost:5000`

## Deployment (Backend)

### Render
1. Create a free account at [Render](https://render.com)
2. Create a new Web Service and connect your GitHub repo
3. Set the root directory to `backend`, build command to `npm install`, and start command to `npm start`
4. Add environment variables from your `.env` file
5. Deploy and get your public backend URL

### Vercel (for simple Node.js APIs)
1. Create a free account at [Vercel](https://vercel.com)
2. Import your GitHub repo and set the root directory to `backend`
3. Set build command to `npm install` and start command to `npm start`
4. Add environment variables from your `.env` file
5. Deploy and get your public backend URL

---
**Note:** This extension does not require any login, signup, or authentication. All features are available directly in the popup UI.