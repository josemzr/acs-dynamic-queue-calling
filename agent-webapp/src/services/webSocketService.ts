import { WebSocketMessage, MessageType } from '../types';

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private agentId: string | null = null;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect(agentId: string): void {
    this.agentId = agentId;
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3002';
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Authenticate as agent
      if (this.agentId) {
        this.send({
          type: 'authenticate_agent',
          agentId: this.agentId,
        });
      }

      this.triggerEvent('connected', {
        type: MessageType.AGENT_STATUS_UPDATE,
        data: { message: 'Connected' },
        timestamp: new Date(),
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.triggerEvent('disconnected', {
        type: MessageType.AGENT_STATUS_UPDATE,
        data: { message: 'Disconnected' },
        timestamp: new Date(),
      });
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('Received WebSocket message:', message);
    
    switch (message.type) {
      case MessageType.CALL_INCOMING:
        this.triggerEvent('call_incoming', message);
        break;
      case MessageType.CALL_ENDED:
        this.triggerEvent('call_ended', message);
        break;
      case MessageType.AGENT_STATUS_UPDATE:
        this.triggerEvent('agent_status_update', message);
        break;
      case 'call_answered' as MessageType:
        this.triggerEvent('call_answered', message);
        break;
      default:
        this.triggerEvent('message', message);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (this.agentId) {
          this.connect(this.agentId);
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.triggerEvent('connection_failed', {
        type: MessageType.AGENT_STATUS_UPDATE,
        data: { message: 'Connection failed' },
        timestamp: new Date(),
      });
    }
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.agentId = null;
    this.reconnectAttempts = 0;
  }

  // Event subscription methods
  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private triggerEvent(event: string, message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}