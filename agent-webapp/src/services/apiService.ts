import { Agent, AgentStatus, Call, ApiResponse, AgentLoginRequest, AgentLoginResponse } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';
// const API_BASE_URL = 'https://grammar-edges-shorts-match.trycloudflare.com/api';

console.log('🔍 API Service Debug:');
console.log('🔍 REACT_APP_API_BASE_URL env var:', process.env.REACT_APP_API_BASE_URL);
console.log('🔍 Final API_BASE_URL:', API_BASE_URL);

export class ApiService {
  private static instance: ApiService;

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private async fetchApi<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: 'Network error or server unavailable',
      };
    }
  }

  // Agent operations
  async login(username: string, password: string): Promise<ApiResponse<AgentLoginResponse>> {
    const loginRequest: AgentLoginRequest = { username, password };
    return this.fetchApi<AgentLoginResponse>('/agents/login', {
      method: 'POST',
      body: JSON.stringify(loginRequest),
    });
  }

  async getAgent(agentId: string): Promise<ApiResponse<Agent>> {
    return this.fetchApi<Agent>(`/agents/${agentId}`);
  }

  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<ApiResponse<Agent>> {
    return this.fetchApi<Agent>(`/agents/${agentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async updateAgentACSUserId(agentId: string, acsUserId: string): Promise<ApiResponse<Agent>> {
    return this.fetchApi<Agent>(`/agents/${agentId}/acs-user`, {
      method: 'PATCH',
      body: JSON.stringify({ acsUserId }),
    });
  }

  // Call operations
  async answerCall(callId: string, agentId: string): Promise<ApiResponse<Call>> {
    return this.fetchApi<Call>(`/calls/${callId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  }

  async endCall(callId: string, agentId: string): Promise<ApiResponse<Call>> {
    return this.fetchApi<Call>(`/calls/${callId}/end`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  }

  async transferCall(callId: string, fromAgentId: string, toAgentId: string): Promise<ApiResponse<Call>> {
    return this.fetchApi<Call>(`/calls/${callId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ fromAgentId, toAgentId }),
    });
  }

  async getCallsByAgent(agentId: string): Promise<ApiResponse<Call[]>> {
    return this.fetchApi<Call[]>(`/calls/agent/${agentId}`);
  }

  // ACS token operations
  async getACSToken(agentId: string): Promise<ApiResponse<{userId: string; token: string; expiresOn: Date}>> {
    return this.fetchApi<{userId: string; token: string; expiresOn: Date}>(`/calls/acs-token/${agentId}`);
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    return this.fetchApi<any>('/health');
  }
}