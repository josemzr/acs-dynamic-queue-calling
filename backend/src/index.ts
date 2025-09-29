import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { AgentService } from './services/agentService';
import { GroupService } from './services/groupService';
import { CallService } from './services/callService';
import { WebSocketService } from './services/webSocketService';

import { AgentController } from './controllers/agentController';
import { GroupController } from './controllers/groupController';
import { CallController } from './controllers/callController';

import { createAgentRoutes } from './routes/agentRoutes';
import { createGroupRoutes } from './routes/groupRoutes';
import { createCallRoutes } from './routes/callRoutes';

// Load environment variables
console.log('🔧 Loading environment configuration...');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = 3002;

console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📊 API Port: ${PORT}`);
console.log(`🔌 WebSocket Port: ${WS_PORT}`);
console.log(`🌐 ACS Configuration: ${process.env.ACS_CONNECTION_STRING ? 'Configured' : 'Not configured'}`);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:4200'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize services
console.log('🔧 Initializing backend services...');

let webSocketService: WebSocketService;
let agentService: AgentService;
let groupService: GroupService;
let callService: CallService;
let agentController: AgentController;
let groupController: GroupController;
let callController: CallController;

try {
  webSocketService = new WebSocketService(WS_PORT);
  agentService = new AgentService();
  groupService = new GroupService(agentService);
  callService = new CallService(agentService, groupService, webSocketService);
  console.log('✅ All backend services initialized successfully');

  // Initialize test data for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 Development mode: Initializing test data...');
    agentService.initializeTestAgents();
  }

  // Initialize controllers
  console.log('🎮 Initializing controllers...');
  agentController = new AgentController(agentService, webSocketService);
  groupController = new GroupController(groupService, webSocketService);
  callController = new CallController(callService, webSocketService);
  console.log('✅ All controllers initialized successfully');

  // Routes
  console.log('🛣️ Setting up API routes...');
  app.use('/api/agents', createAgentRoutes(agentController));
  app.use('/api/groups', createGroupRoutes(groupController));
  app.use('/api/calls', createCallRoutes(callController));
  console.log('✅ API routes configured successfully');

} catch (error) {
  console.error('❌ Failed to initialize backend services:', error instanceof Error ? error.message : error);
  console.error('🛑 Server startup aborted');
  process.exit(1);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  const callbackBaseUrl = process.env.ACS_CALLBACK_BASE_URL || `http://localhost:${PORT}`;
  const callbackUrl = `${callbackBaseUrl}/api/calls/incoming`;
  
  res.json({
    success: true,
    message: 'ACS Dynamic Queue API is running',
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      websocket: 'healthy'
    },
    acs: {
      callbackUrl: callbackUrl,
      configured: Boolean(process.env.ACS_CONNECTION_STRING && process.env.ACS_ENDPOINT)
    }
  });
});

// Statistics endpoint
app.get('/api/statistics', (req, res) => {
  const agents = agentService.getAllAgents();
  const groups = groupService.getAllGroups();
  const activeCalls = callService.getActiveCalls();

  const statistics = {
    agents: {
      total: agents.length,
      available: agents.filter(a => a.status === 'available').length,
      busy: agents.filter(a => a.status === 'busy' || a.status === 'in_call').length,
      offline: agents.filter(a => a.status === 'offline').length
    },
    groups: {
      total: groups.length,
      withOverflow: groups.filter(g => g.overflowEnabled).length
    },
    calls: {
      active: activeCalls.length,
      incoming: activeCalls.filter(c => c.status === 'incoming').length,
      ringing: activeCalls.filter(c => c.status === 'ringing').length,
      connected: activeCalls.filter(c => c.status === 'connected').length
    },
    websocket: {
      connectedAgents: webSocketService.getConnectedAgents().length,
      connectedSupervisors: webSocketService.getConnectedSupervisors().length
    }
  };

  res.json({
    success: true,
    data: statistics
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ACS Dynamic Queue API server running on port ${PORT}`);
  console.log(`🔌 WebSocket server running on port ${WS_PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📈 Statistics: http://localhost:${PORT}/api/statistics`);
});

export default app;