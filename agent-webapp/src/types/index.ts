// Shared types from backend
export interface Agent {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string; // In production, this should be hashed
  status: AgentStatus;
  groupIds: string[];
  currentCallId?: string;
  lastActivity: Date;
  statistics: AgentStatistics;
}

export enum AgentStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
  IN_CALL = 'in_call'
}

export interface AgentStatistics {
  totalCalls: number;
  totalCallDuration: number;
  averageCallDuration: number;
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  lastCallTime?: Date;
}

export interface Call {
  id: string;
  phoneNumber: string;
  groupId: string;
  assignedAgentId?: string;
  status: CallStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  waitTime?: number;
}

export enum CallStatus {
  INCOMING = 'incoming',
  RINGING = 'ringing',
  CONNECTED = 'connected',
  ENDED = 'ended',
  TRANSFERRED = 'transferred'
}

export interface WebSocketMessage {
  type: MessageType;
  data: any;
  timestamp: Date;
}

export enum MessageType {
  AGENT_STATUS_UPDATE = 'agent_status_update',
  CALL_INCOMING = 'call_incoming',
  CALL_ENDED = 'call_ended',
  GROUP_UPDATE = 'group_update',
  STATISTICS_UPDATE = 'statistics_update'
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Agent webapp specific types
export interface AgentLoginRequest {
  username: string;
  password: string;
}

export interface AgentLoginResponse {
  agent: Agent;
  token?: string; // For future auth implementation
}

export interface CallNotification {
  call: Call;
  message: string;
  timestamp: Date;
}