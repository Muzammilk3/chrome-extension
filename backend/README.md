
# Productivity Tracker Backend

Backend API server for the Productivity Tracker Chrome Extension built with Node.js and Express. No login, signup, or authentication required for extension usage.

## Features

- **Activity Tracking**: Monitor website usage, time tracking, and productivity metrics
- **Reports Generation**: Automated daily, weekly, and monthly productivity reports
- **Email Notifications**: Automated report delivery and goal achievement alerts
- **Goal Management**: Set and track productivity goals
- **Site Blocking**: Manage blocked websites and focus sessions
- **Cross-device Sync**: Synchronize data across multiple devices
- **Background Jobs**: Automated report generation and data cleanup

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Email**: Nodemailer with Handlebars templates
- **Scheduling**: Node-cron for background jobs
- **Security**: Helmet, CORS, rate limiting
- **Validation**: Express-validator

## How to Run

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation & Start
1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd productivity-tracker/backend
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Copy environment file and edit as needed:
   ```sh
   cp .env.example .env
   # Edit .env with your configuration
   ```
4. Start MongoDB (service or Docker):
   ```sh
   sudo service mongod start
   # or
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```
5. Start the backend server:
   ```sh
   npm run dev   # Development
   npm start     # Production
   ```
The server will start on `http://localhost:5000` (or your configured PORT).

## Support & Questions
- **Email:** muzammilahmedk3@gmail.com
- **GitHub:** [Muzammilk3](https://github.com/Muzammilk3)

## API Documentation
[...existing code...]

## API Documentation

### Authentication Endpoints

```
POST /api/auth/register          # User registration
POST /api/auth/login             # User login
POST /api/auth/google            # Google OAuth login
POST /api/auth/refresh           # Refresh JWT token
POST /api/auth/logout            # User logout
POST /api/auth/forgot-password   # Password reset request
POST /api/auth/reset-password    # Password reset confirmation
```

### User Management

```
GET  /api/users/profile          # Get user profile
PUT  /api/users/profile          # Update user profile
PUT  /api/users/settings         # Update user settings
GET  /api/users/blocked-sites    # Get blocked sites
POST /api/users/blocked-sites    # Add blocked site
DELETE /api/users/blocked-sites/:id # Remove blocked site
GET  /api/users/statistics       # Get user statistics
PUT  /api/users/change-password  # Change password
DELETE /api/users/account        # Delete account
```

### Tracking Data

```
POST /api/tracking/record        # Record tracking data
POST /api/tracking/sync          # Sync tracking data
GET  /api/tracking/daily         # Get daily tracking data
GET  /api/tracking/weekly        # Get weekly tracking data
GET  /api/tracking/categories    # Get category breakdown
```

### Reports

```
GET  /api/reports/daily          # Get daily report
GET  /api/reports/weekly         # Get weekly report
GET  /api/reports/monthly        # Get monthly report
GET  /api/reports/productivity-trend # Get productivity trend
GET  /api/reports/insights       # Get personalized insights
GET  /api/reports/compare        # Compare periods
GET  /api/reports/export         # Export report data
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/productivity_tracker` |
| `PORT` | Server port | `5000` |
| `JWT_SECRET` | JWT signing secret | Required |
| `NODE_ENV` | Environment mode | `development` |
| `EMAIL_USER` | Email account for notifications | Required for email features |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Required for Google auth |

### Database Schema

The application uses the following main collections:

- **users**: User accounts and settings
- **trackingdatas**: Website usage tracking data
- **reports**: Generated productivity reports

## Development

### Project Structure

```
backend/
├── models/           # Database models
├── routes/           # API route handlers
├── middleware/       # Express middleware
├── services/         # Business logic services
├── templates/        # Email templates
├── scripts/          # Database scripts
├── tests/            # Test files
└── server.js         # Application entry point
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run specific test file
npm test tests/auth.test.js
```

### Database Management

```bash
# Seed database with sample data
npm run seed

# Run database migrations
npm run migrate
```

## Email Templates

Email templates are located in `templates/email/` and use Handlebars for templating:

- `welcome.hbs` - Welcome email for new users
- `daily-report.hbs` - Daily productivity report
- `weekly-report.hbs` - Weekly productivity summary
- `monthly-report.hbs` - Monthly productivity analysis
- `password-reset.hbs` - Password reset email
- `goal-achieved.hbs` - Goal achievement notification

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing protection
- **Rate Limiting**: API request throttling
- **JWT**: Secure token-based authentication
- **Input Validation**: Request data validation
- **Password Hashing**: bcrypt for secure password storage

## Background Jobs

The application includes scheduled jobs for:

- **Daily Reports**: Generated at 7:00 AM daily
- **Weekly Reports**: Generated at 8:00 AM every Monday
- **Data Cleanup**: Old reports cleanup every Sunday at midnight

## Deployment

### Production Checklist

1. Set `NODE_ENV=production`
2. Configure production MongoDB URI
3. Set strong JWT secret
4. Configure email service (SendGrid, AWS SES, etc.)
5. Set up SSL/TLS certificates
6. Configure reverse proxy (nginx)
7. Set up monitoring and logging

```

## API Rate Limiting

Default rate limits:
- 100 requests per 15 minutes per IP
- Configurable via environment variables

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": [] // Validation errors if applicable
}
```

## Support

For questions or issues:
1. Check the API documentation
2. Review error logs
3. Check MongoDB connection
4. Verify environment configuration

## License

MIT License - see LICENSE file for details
