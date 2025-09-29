# ACS Dynamic Queue Calling System

A comprehensive dynamic queue system built with Azure Communication Services for managing customer agents, groups, and call routing with real-time monitoring capabilities.

## Architecture

The system consists of three main components:

1. **Backend API** (Node.js/Express with TypeScript)
2. **Agent WebApp** (React with TypeScript)
3. **Supervisor WebApp** (Angular with TypeScript)

## Features

### Backend API
- RESTful API with TypeScript
- Agent management (CRUD operations, status tracking)
- Group management (location-based, overflow routing)
- Call handling (incoming, answer, end, transfer)
- Real-time WebSocket communications
- Statistics and monitoring endpoints
- Azure Communication Services integration for PSTN calling

### Agent WebApp
- Professional login interface with ACS token management
- Real-time dashboard with agent status
- Call interface with incoming call notifications
- Two-way audio calling through Azure Communication Services
- Status management (Available, Busy, Offline, In Call)
- Live statistics (calls, duration, productivity metrics)
- WebSocket integration for real-time updates

### Supervisor WebApp
- Comprehensive dashboard with real-time statistics
- Agent monitoring and management
- Group management with location-based organization
- Active calls monitoring
- Overflow routing controls
- Real-time updates via WebSocket

## Important: Public Accessibility Requirement

⚠️ **This application requires a publicly accessible backend for proper functionality.** Azure Communication Services webhooks need to reach your backend API to deliver incoming calls.

### Required Setup: Public Tunnel (ngrok or similar)

Since ACS webhooks cannot reach `localhost`, you **must** use a tunneling service:

#### Option 1: ngrok (Recommended)
```bash
# Install ngrok
npm install -g ngrok

# Create tunnel to your backend (port 3001)
ngrok http 3001

# Use the provided public URL (e.g., https://abc123.ngrok.io)
```

#### Option 2: Cloudflare Tunnel
```bash
# Install cloudflared
# Follow Cloudflare Tunnel setup

# Create tunnel
cloudflared tunnel --url http://localhost:3001
```

#### Option 3: Deploy to Cloud
Deploy the backend to any cloud provider:
- **Azure App Service**
- **AWS EC2/ECS**
- **Google Cloud Run**
- **Heroku**
- **DigitalOcean**

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Azure Communication Services resource
- **Public tunnel service (ngrok, cloudflared, etc.) OR cloud deployment**

### Installation

1. **Install all project dependencies**
   ```bash
   npm run install:all
   ```

2. **Set up public tunnel for your backend**
   ```bash
   # Start ngrok in a separate terminal
   ngrok http 3001
   
   # Note the public URL (e.g., https://abc123.ngrok.io)
   ```

3. **Configure environment variables**
   
   Backend (.env):
   ```
   ACS_CONNECTION_STRING=your-acs-connection-string
   ACS_ENDPOINT=your-acs-endpoint
   ACS_CALLBACK_BASE_URL=https://your-ngrok-url.ngrok.io
   PORT=3001
   NODE_ENV=production
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4200
   ```

   Agent WebApp (.env):
   ```
   REACT_APP_API_BASE_URL=https://your-ngrok-url.ngrok.io/api
   REACT_APP_WS_URL=wss://your-ngrok-url.ngrok.io
   ```

4. **Configure Azure Communication Services**
   
   In your Azure portal, configure ACS Event Grid with your public callback URL:
   - **Callback URL**: `https://your-ngrok-url.ngrok.io/api/calls/incoming`
   - **Events**: Subscribe to `Microsoft.Communication.IncomingCall`
   
   You can verify the callback URL by checking the health endpoint:
   ```bash
   curl https://your-ngrok-url.ngrok.io/api/health
   ```

### Running the Application

1. **Start the public tunnel** (if not already running)
   ```bash
   ngrok http 3001
   ```

2. **Start all services**
   ```bash
   npm run dev
   ```

3. **Or start services individually:**
   
   Backend API:
   ```bash
   cd backend && npm run dev
   ```
   
   Agent WebApp:
   ```bash
   cd agent-webapp && npm start
   ```
   
   Supervisor WebApp:
   ```bash
   cd supervisor-webapp && npm start
   ```

### Access URLs
- Backend API: https://localhost:3001 or https://your-ngrok-url.ngrok.io (public)
- Agent WebApp: http://localhost:3000 (local)
- Supervisor WebApp: http://localhost:4200 (local)
- WebSocket Server: https://localhost:3001 or wss://your-ngrok-url.ngrok.io (public)

## Key Features

### Real Azure Communication Services Integration
- **PSTN Calling**: Real phone number integration for incoming calls
- **Agent Audio**: Two-way audio through ACS Calling SDK
- **Call Transfer**: Automatic transfer from server-side to agent client-side control
- **Call Management**: Answer, hold, mute, and end calls

### Dynamic Queue Management
- Location-based agent groups (Madrid, Barcelona, etc.)
- Automatic call routing to available agents
- Overflow routing when all agents in a group are busy
- Real-time agent status tracking

### Supervisor Controls
- Add/remove agents from groups
- Enable/disable overflow routing between groups
- Monitor all agents and calls in real-time
- View productivity statistics

### Agent Interface
- ACS token-based authentication for calling
- Incoming call notifications with browser notifications
- Full call control (answer, end, mute, hold)
- Personal statistics tracking

### Real-time Updates
- WebSocket connections for instant updates
- Live agent status changes
- Real-time call notifications
- Automatic dashboard refreshes

## Testing with Real Phone Calls

### Prerequisites for Testing
1. **Public tunnel running** (ngrok or deployed backend)
2. **Azure Communication Services configured** with your public callback URL
3. **Phone number assigned** to your ACS resource
4. **All services running** and accessible

### Testing Real Calls

1. **Configure ACS Phone Number:**
   - In Azure portal, assign a phone number to your ACS resource
   - Configure Event Grid to send webhook events to your public URL
   - Set up the phone number in your groups configuration

2. **Test Agent Login:**
   - Navigate to http://localhost:3000
   - Login with agent credentials
   - Set status to "Available"
   - Agent should receive ACS token and be ready for calls

3. **Make Test Call:**
   - Call the phone number assigned to your ACS resource
   - Call should appear in agent interface
   - Agent can answer, talk, and end the call

4. **Monitor in Supervisor:**
   - Navigate to http://localhost:4200
   - Monitor real-time call statistics
   - View agent status changes during calls

### Sample Test Configuration

#### Test Groups with Phone Numbers
```bash
# Create a test group with real phone number
curl -X POST https://your-ngrok-url.ngrok.io/api/groups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Team",
    "location": "Madrid",
    "phoneNumber": "+1234567890",
    "overflowEnabled": true
  }'
```

#### Test Agents
```bash
# Create a test agent
curl -X POST https://your-ngrok-url.ngrok.io/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "email": "test@example.com",
    "groupIds": ["group-id-here"]
  }'
```

## Architecture & ACS Communication

### Communication Flow
The system is designed for production call center operations:

1. **PSTN Calls**: Real phone calls come through Azure Communication Services
2. **Server-side Call Control**: Backend answers and manages initial call routing
3. **Client-side Transfer**: Calls are transferred to agents' ACS Calling SDK for audio
4. **Real-time Coordination**: WebSocket ensures all components stay synchronized

### Production Deployment Architecture
```
Phone Call → ACS → Public Backend → Agent Browser (ACS SDK)
                       ↓
                  Supervisor Dashboard
```

**Key Requirements:**
- **Backend must be publicly accessible** for ACS webhooks
- **HTTPS required** for production ACS integration
- **WebSocket support** needed for real-time updates
- **ACS credentials** properly configured

## Troubleshooting

### Common Issues

1. **No incoming calls received:**
   - Verify ngrok/tunnel is running and public URL is accessible
   - Check ACS Event Grid configuration points to correct webhook URL
   - Ensure phone number is properly assigned to ACS resource
   - Check backend logs for webhook delivery attempts

2. **Agent can't answer calls (no audio):**
   - Verify ACS connection string is correct
   - Check browser permissions for microphone access
   - Ensure ACS token generation is working (check network tab)
   - Verify agent is in "Available" status

3. **Calls disconnect immediately:**
   - Check for transfer-related disconnect events in logs
   - Verify ACS Calling SDK initialization
   - Ensure persistent audio stream is maintained
   - Check for browser audio permission issues

4. **WebSocket connection fails:**
   - Verify public tunnel supports WebSocket (ngrok does by default)
   - Check browser console for connection errors
   - Ensure WSS (secure WebSocket) for HTTPS backends

### Environment Variables Checklist

**Critical Backend Configuration:**
```bash
# Must be your PUBLIC tunnel URL, not localhost
ACS_CALLBACK_BASE_URL=https://your-ngrok-url.ngrok.io

# Production mode for proper ACS integration
NODE_ENV=production

# Your actual ACS credentials
ACS_CONNECTION_STRING=endpoint=https://...;accesskey=...
```

**Agent WebApp Configuration:**
```bash
# Must point to your PUBLIC backend URL
REACT_APP_API_BASE_URL=https://your-ngrok-url.ngrok.io/api

# Must use WSS for secure WebSocket over HTTPS
REACT_APP_WS_URL=wss://your-ngrok-url.ngrok.io
```

### ACS Integration Verification

1. **Test webhook endpoint:**
   ```bash
   curl https://your-ngrok-url.ngrok.io/api/calls/incoming
   ```

2. **Verify ACS token generation:**
   ```bash
   curl https://your-ngrok-url.ngrok.io/api/calls/acs-token/agent-001
   ```

3. **Check ACS Event Grid configuration:**
   - Webhook URL: `https://your-ngrok-url.ngrok.io/api/calls/incoming`
   - Event Types: `Microsoft.Communication.IncomingCall`
   - Validation: Ensure webhook validation succeeds

### Production Deployment Notes

For production deployment:

1. **Deploy backend** to cloud service with HTTPS
2. **Configure domain** with proper SSL certificate
3. **Update ACS Event Grid** with production webhook URL
4. **Set production environment variables** in deployed backend
5. **Build and deploy** frontend applications
6. **Test end-to-end** with real phone calls

**Security Considerations:**
- Use proper authentication for production
- Implement rate limiting for webhook endpoints
- Secure ACS credentials with environment variables
- Enable CORS only for trusted origins
- Use WSS for WebSocket connections