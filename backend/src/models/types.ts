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
  totalCallDuration: number; // in seconds
  averageCallDuration: number;
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  lastCallTime?: Date;
}

export interface Group {
  id: string;
  name: string;
  location: string;
  phoneNumber: string;
  agentIds: string[];
  overflowGroupIds: string[];
  overflowEnabled: boolean;
  statistics: GroupStatistics;
}

export interface GroupStatistics {
  totalCalls: number;
  averageWaitTime: number;
  callsInQueue: number;
  busyAgents: number;
  availableAgents: number;
  totalAgents: number;
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
  // ACS-specific fields for call control
  acsCallConnectionId?: string;
  acsIncomingCallContext?: string;
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

export interface CreateAgentRequest {
  name: string;
  email: string;
  username: string;
  password: string;
  groupIds: string[];
}

export interface UpdateAgentRequest {
  name?: string;
  email?: string;
  username?: string;
  password?: string;
  groupIds?: string[];
  status?: AgentStatus;
  currentCallId?: string;
  statistics?: AgentStatistics;
}

export interface CreateGroupRequest {
  name: string;
  location: string;
  phoneNumber: string;
  overflowEnabled?: boolean;
  overflowGroupIds?: string[];
}

export interface UpdateGroupRequest {
  name?: string;
  location?: string;
  phoneNumber?: string;
  overflowEnabled?: boolean;
  overflowGroupIds?: string[];
}

export interface AgentLoginRequest {
  username: string;
  password: string;
}

export interface AgentLoginResponse {
  agent: Agent;
  token?: string; // For future auth implementation
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}