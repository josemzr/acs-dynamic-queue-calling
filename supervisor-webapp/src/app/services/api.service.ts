import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  Agent, 
  Group, 
  Call, 
  ApiResponse, 
  CreateAgentRequest, 
  UpdateAgentRequest,
  CreateGroupRequest,
  UpdateGroupRequest 
} from '../models/types';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // Agent endpoints
  getAllAgents(): Observable<ApiResponse<Agent[]>> {
    return this.http.get<ApiResponse<Agent[]>>(`${this.baseUrl}/agents`);
  }

  getAgent(id: string): Observable<ApiResponse<Agent>> {
    return this.http.get<ApiResponse<Agent>>(`${this.baseUrl}/agents/${id}`);
  }

  createAgent(agent: CreateAgentRequest): Observable<ApiResponse<Agent>> {
    return this.http.post<ApiResponse<Agent>>(`${this.baseUrl}/agents`, agent);
  }

  updateAgent(id: string, updates: UpdateAgentRequest): Observable<ApiResponse<Agent>> {
    return this.http.put<ApiResponse<Agent>>(`${this.baseUrl}/agents/${id}`, updates);
  }

  deleteAgent(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/agents/${id}`);
  }

  getAgentsByGroup(groupId: string): Observable<ApiResponse<Agent[]>> {
    return this.http.get<ApiResponse<Agent[]>>(`${this.baseUrl}/agents/group/${groupId}`);
  }

  // Group endpoints
  getAllGroups(): Observable<ApiResponse<Group[]>> {
    return this.http.get<ApiResponse<Group[]>>(`${this.baseUrl}/groups`);
  }

  getGroup(id: string): Observable<ApiResponse<Group>> {
    return this.http.get<ApiResponse<Group>>(`${this.baseUrl}/groups/${id}`);
  }

  createGroup(group: CreateGroupRequest): Observable<ApiResponse<Group>> {
    return this.http.post<ApiResponse<Group>>(`${this.baseUrl}/groups`, group);
  }

  updateGroup(id: string, updates: UpdateGroupRequest): Observable<ApiResponse<Group>> {
    return this.http.put<ApiResponse<Group>>(`${this.baseUrl}/groups/${id}`, updates);
  }

  deleteGroup(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/groups/${id}`);
  }

  addAgentToGroup(groupId: string, agentId: string): Observable<ApiResponse<Group>> {
    return this.http.post<ApiResponse<Group>>(`${this.baseUrl}/groups/${groupId}/agents/${agentId}`, {});
  }

  removeAgentFromGroup(groupId: string, agentId: string): Observable<ApiResponse<Group>> {
    return this.http.delete<ApiResponse<Group>>(`${this.baseUrl}/groups/${groupId}/agents/${agentId}`);
  }

  setOverflowGroups(groupId: string, overflowGroupIds: string[]): Observable<ApiResponse<Group>> {
    return this.http.put<ApiResponse<Group>>(`${this.baseUrl}/groups/${groupId}/overflow`, { overflowGroupIds });
  }

  enableOverflow(groupId: string, enabled: boolean): Observable<ApiResponse<Group>> {
    return this.http.patch<ApiResponse<Group>>(`${this.baseUrl}/groups/${groupId}/overflow/enable`, { enabled });
  }

  // Call endpoints
  getActiveCalls(): Observable<ApiResponse<Call[]>> {
    return this.http.get<ApiResponse<Call[]>>(`${this.baseUrl}/calls/active`);
  }

  getCallsByAgent(agentId: string): Observable<ApiResponse<Call[]>> {
    return this.http.get<ApiResponse<Call[]>>(`${this.baseUrl}/calls/agent/${agentId}`);
  }

  getCallsByGroup(groupId: string): Observable<ApiResponse<Call[]>> {
    return this.http.get<ApiResponse<Call[]>>(`${this.baseUrl}/calls/group/${groupId}`);
  }

  // Statistics endpoint
  getStatistics(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/statistics`);
  }

  // Health check
  healthCheck(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/health`);
  }
}