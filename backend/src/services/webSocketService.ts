import { WebSocket, WebSocketServer } from 'ws';
import { WebSocketMessage, MessageType } from '../models/types';
import { IncomingMessage } from 'http';

interface ClientConnection {
  ws: WebSocket;
  agentId?: string;
  supervisorId?: string;
  type: 'agent' | 'supervisor';
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();

  constructor(port: number) {
    try {
      this.wss = new WebSocketServer({ port });
      this.setupWebSocketServer();
      console.log(`🔌 WebSocketService: Successfully initialized on port ${port}`);
    } catch (error) {
      console.error(`❌ WebSocketService: Failed to initialize on port ${port}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = this.generateClientId();
      const connection: ClientConnection = {
        ws,
        type: 'agent' // Default, will be updated when client authenticates
      };

      this.clients.set(clientId, connection);
      console.log(`🔗 WebSocketService: New client connected (${clientId})`);

      ws.on('message', (message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          this.handleMessage(clientId, parsedMessage);
        } catch (error) {
          console.error(`❌ WebSocketService: Error parsing message from ${clientId}:`, error);
        }
      });

      ws.on('close', () => {
        const connection = this.clients.get(clientId);
        console.log(`🔌 WebSocketService: Client disconnected (${clientId}${connection?.agentId ? `, agent: ${connection.agentId}` : ''})`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocketService: Client error (${clientId}):`, error);
        this.clients.delete(clientId);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: MessageType.AGENT_STATUS_UPDATE,
        data: { message: 'Connected to ACS Dynamic Queue' },
        timestamp: new Date()
      });
    });
  }

  private handleMessage(clientId: string, message: any): void {
    const connection = this.clients.get(clientId);
    if (!connection) {
      return;
    }

    switch (message.type) {
      case 'authenticate_agent':
        connection.agentId = message.agentId;
        connection.type = 'agent';
        this.clients.set(clientId, connection);
        break;

      case 'authenticate_supervisor':
        connection.supervisorId = message.supervisorId;
        connection.type = 'supervisor';
        this.clients.set(clientId, connection);
        break;

      case 'ping':
        this.sendToClient(clientId, {
          type: MessageType.AGENT_STATUS_UPDATE,
          data: { message: 'pong' },
          timestamp: new Date()
        });
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const connection = this.clients.get(clientId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  notifyAgent(agentId: string, type: string, data: any): void {
    const message: WebSocketMessage = {
      type: type as MessageType,
      data,
      timestamp: new Date()
    };

    // Find agent connection
    for (const [clientId, connection] of this.clients.entries()) {
      if (connection.agentId === agentId && connection.type === 'agent') {
        this.sendToClient(clientId, message);
        break;
      }
    }
  }

  notifySupervisors(type: string, data: any): void {
    const message: WebSocketMessage = {
      type: type as MessageType,
      data,
      timestamp: new Date()
    };

    // Send to all supervisor connections
    for (const [clientId, connection] of this.clients.entries()) {
      if (connection.type === 'supervisor') {
        this.sendToClient(clientId, message);
      }
    }
  }

  broadcast(type: string, data: any): void {
    const message: WebSocketMessage = {
      type: type as MessageType,
      data,
      timestamp: new Date()
    };

    // Send to all connected clients
    for (const [clientId, connection] of this.clients.entries()) {
      this.sendToClient(clientId, message);
    }
  }

  broadcastToAgents(type: string, data: any): void {
    const message: WebSocketMessage = {
      type: type as MessageType,
      data,
      timestamp: new Date()
    };

    // Send to all agent connections
    for (const [clientId, connection] of this.clients.entries()) {
      if (connection.type === 'agent') {
        this.sendToClient(clientId, message);
      }
    }
  }

  getConnectedAgents(): string[] {
    const agentIds: string[] = [];
    for (const connection of this.clients.values()) {
      if (connection.type === 'agent' && connection.agentId) {
        agentIds.push(connection.agentId);
      }
    }
    return agentIds;
  }

  getConnectedSupervisors(): string[] {
    const supervisorIds: string[] = [];
    for (const connection of this.clients.values()) {
      if (connection.type === 'supervisor' && connection.supervisorId) {
        supervisorIds.push(connection.supervisorId);
      }
    }
    return supervisorIds;
  }

  isAgentConnected(agentId: string): boolean {
    for (const connection of this.clients.values()) {
      if (connection.agentId === agentId && connection.type === 'agent') {
        return true;
      }
    }
    return false;
  }

  disconnectAgent(agentId: string): boolean {
    for (const [clientId, connection] of this.clients.entries()) {
      if (connection.agentId === agentId && connection.type === 'agent') {
        connection.ws.close();
        this.clients.delete(clientId);
        return true;
      }
    }
    return false;
  }
}