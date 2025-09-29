import { Group, GroupStatistics, CreateGroupRequest, UpdateGroupRequest } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import { AgentService } from './agentService';

export class GroupService {
  private groups: Map<string, Group> = new Map();
  private agentService: AgentService;

  constructor(agentService: AgentService) {
    this.agentService = agentService;
    console.log('👥 GroupService: Successfully initialized');
  }

  createGroup(request: CreateGroupRequest): Group {
    const group: Group = {
      id: uuidv4(),
      name: request.name,
      location: request.location,
      phoneNumber: request.phoneNumber,
      agentIds: [],
      overflowGroupIds: request.overflowGroupIds || [],
      overflowEnabled: request.overflowEnabled || false,
      statistics: {
        totalCalls: 0,
        averageWaitTime: 0,
        callsInQueue: 0,
        busyAgents: 0,
        availableAgents: 0,
        totalAgents: 0
      }
    };

    this.groups.set(group.id, group);
    console.log(`📋 GroupService: Created new group "${group.name}" (${group.id}) with phone ${group.phoneNumber}`);
    return group;
  }

  getGroup(id: string): Group | undefined {
    return this.groups.get(id);
  }

  getAllGroups(): Group[] {
    return Array.from(this.groups.values());
  }

  getGroupByPhoneNumber(phoneNumber: string): Group | undefined {
    return Array.from(this.groups.values()).find(group => 
      group.phoneNumber === phoneNumber
    );
  }

  updateGroup(id: string, updates: UpdateGroupRequest): Group | null {
    const group = this.groups.get(id);
    if (!group) {
      return null;
    }

    const updatedGroup: Group = {
      ...group,
      ...updates
    };

    this.groups.set(id, updatedGroup);
    return updatedGroup;
  }

  deleteGroup(id: string): boolean {
    // Remove group from all agents
    const agents = this.agentService.getAllAgents();
    agents.forEach(agent => {
      if (agent.groupIds.includes(id)) {
        const newGroupIds = agent.groupIds.filter(gId => gId !== id);
        this.agentService.updateAgent(agent.id, { groupIds: newGroupIds });
      }
    });

    return this.groups.delete(id);
  }

  addAgentToGroup(groupId: string, agentId: string): boolean {
    const group = this.groups.get(groupId);
    const agent = this.agentService.getAgent(agentId);
    
    if (!group || !agent) {
      return false;
    }

    // Add agent to group
    if (!group.agentIds.includes(agentId)) {
      group.agentIds.push(agentId);
      this.groups.set(groupId, group);
    }

    // Add group to agent
    if (!agent.groupIds.includes(groupId)) {
      agent.groupIds.push(groupId);
      this.agentService.updateAgent(agentId, { groupIds: agent.groupIds });
    }

    this.updateGroupStatistics(groupId);
    return true;
  }

  removeAgentFromGroup(groupId: string, agentId: string): boolean {
    const group = this.groups.get(groupId);
    const agent = this.agentService.getAgent(agentId);
    
    if (!group || !agent) {
      return false;
    }

    // Remove agent from group
    group.agentIds = group.agentIds.filter(id => id !== agentId);
    this.groups.set(groupId, group);

    // Remove group from agent
    agent.groupIds = agent.groupIds.filter(id => id !== groupId);
    this.agentService.updateAgent(agentId, { groupIds: agent.groupIds });

    this.updateGroupStatistics(groupId);
    return true;
  }

  updateGroupStatistics(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) {
      return;
    }

    const agents = this.agentService.getAgentsByGroup(groupId);
    const availableAgents = agents.filter(agent => agent.status === 'available');
    const busyAgents = agents.filter(agent => agent.status === 'busy' || agent.status === 'in_call');

    const statistics: GroupStatistics = {
      ...group.statistics,
      totalAgents: agents.length,
      availableAgents: availableAgents.length,
      busyAgents: busyAgents.length
    };

    group.statistics = statistics;
    this.groups.set(groupId, group);
  }

  getAvailableGroups(originalGroupId: string): Group[] {
    const originalGroup = this.groups.get(originalGroupId);
    if (!originalGroup || !originalGroup.overflowEnabled) {
      return [];
    }

    return originalGroup.overflowGroupIds
      .map(id => this.groups.get(id))
      .filter((group): group is Group => {
        if (!group) return false;
        const availableAgents = this.agentService.getAvailableAgentsByGroup(group.id);
        return availableAgents.length > 0;
      });
  }

  setOverflowGroups(groupId: string, overflowGroupIds: string[]): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }

    group.overflowGroupIds = overflowGroupIds;
    this.groups.set(groupId, group);
    return true;
  }

  enableOverflow(groupId: string, enabled: boolean): boolean {
    const group = this.groups.get(groupId);
    if (!group) {
      return false;
    }

    group.overflowEnabled = enabled;
    this.groups.set(groupId, group);
    return true;
  }
}