import { Agent, AgentStatus, AgentStatistics, CreateAgentRequest, UpdateAgentRequest } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export class AgentService {
  private agents: Map<string, Agent> = new Map();

  constructor() {
    console.log('🧑‍💼 AgentService: Successfully initialized');
  }

  createAgent(request: CreateAgentRequest): Agent {
    const agent: Agent = {
      id: uuidv4(),
      name: request.name,
      email: request.email,
      username: request.username,
      password: request.password, // In production, this should be hashed
      status: AgentStatus.OFFLINE,
      groupIds: request.groupIds,
      lastActivity: new Date(),
      statistics: {
        totalCalls: 0,
        totalCallDuration: 0,
        averageCallDuration: 0,
        callsToday: 0,
        callsThisWeek: 0,
        callsThisMonth: 0
      }
    };

    this.agents.set(agent.id, agent);
    console.log(`👤 AgentService: Created new agent "${agent.name}" (${agent.id})`);
    return agent;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  authenticateAgent(username: string, password: string): Agent | null {
    const agents = Array.from(this.agents.values());
    const agent = agents.find(a => a.username === username && a.password === password);
    return agent || null;
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByGroup(groupId: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent => 
      agent.groupIds.includes(groupId)
    );
  }

  getAvailableAgentsByGroup(groupId: string): Agent[] {
    return this.getAgentsByGroup(groupId).filter(agent => 
      agent.status === AgentStatus.AVAILABLE
    );
  }

  updateAgent(id: string, updates: UpdateAgentRequest): Agent | null {
    const agent = this.agents.get(id);
    if (!agent) {
      return null;
    }

    const updatedAgent: Agent = {
      ...agent,
      ...updates,
      lastActivity: new Date()
    };

    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }

  updateAgentStatus(id: string, status: AgentStatus): Agent | null {
    return this.updateAgent(id, { status });
  }

  updateAgentACSUserId(id: string, acsUserId: string): Agent | null {
    const agent = this.agents.get(id);
    if (!agent) {
      return null;
    }

    // Add acsUserId to the agent object
    (agent as any).acsUserId = acsUserId;
    agent.lastActivity = new Date();
    this.agents.set(id, agent);
    
    return agent;
  }

  deleteAgent(id: string): boolean {
    return this.agents.delete(id);
  }

  assignCallToAgent(agentId: string, callId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== AgentStatus.AVAILABLE) {
      return false;
    }

    this.updateAgent(agentId, {
      status: AgentStatus.IN_CALL,
      currentCallId: callId
    });

    return true;
  }

  releaseAgentFromCall(agentId: string, callDuration: number): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Update statistics
    const newStatistics: AgentStatistics = {
      ...agent.statistics,
      totalCalls: agent.statistics.totalCalls + 1,
      totalCallDuration: agent.statistics.totalCallDuration + callDuration,
      averageCallDuration: (agent.statistics.totalCallDuration + callDuration) / (agent.statistics.totalCalls + 1),
      callsToday: this.isToday(new Date()) ? agent.statistics.callsToday + 1 : 1,
      callsThisWeek: this.isThisWeek(new Date()) ? agent.statistics.callsThisWeek + 1 : 1,
      callsThisMonth: this.isThisMonth(new Date()) ? agent.statistics.callsThisMonth + 1 : 1,
      lastCallTime: new Date()
    };

    this.updateAgent(agentId, {
      status: AgentStatus.AVAILABLE,
      currentCallId: undefined,
      statistics: newStatistics
    });

    return true;
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  private isThisWeek(date: Date): boolean {
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
    return date >= weekStart;
  }

  private isThisMonth(date: Date): boolean {
    const today = new Date();
    return date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  initializeTestAgents(): void {
    // Create test agents as documented in README
    const testAgents = [
      {
        id: 'agent-001',
        name: 'John Doe',
        email: 'john.doe@example.com',
        username: 'john.doe',
        password: 'password123',
        groupIds: []
      },
      {
        id: 'agent-002', 
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        username: 'jane.smith',
        password: 'password123',
        groupIds: []
      },
      {
        id: 'agent-003',
        name: 'Bob Wilson', 
        email: 'bob.wilson@example.com',
        username: 'bob.wilson',
        password: 'password123',
        groupIds: []
      }
    ];

    testAgents.forEach(testAgent => {
      const agent: Agent = {
        id: testAgent.id,
        name: testAgent.name,
        email: testAgent.email,
        username: testAgent.username,
        password: testAgent.password,
        status: AgentStatus.OFFLINE,
        groupIds: testAgent.groupIds,
        lastActivity: new Date(),
        statistics: {
          totalCalls: 0,
          totalCallDuration: 0,
          averageCallDuration: 0,
          callsToday: 0,
          callsThisWeek: 0,
          callsThisMonth: 0
        }
      };
      
      this.agents.set(agent.id, agent);
    });

    console.log(`✅ Initialized ${testAgents.length} test agents`);
  }
}