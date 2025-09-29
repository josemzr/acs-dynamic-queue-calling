import { Call, CallStatus, Agent, Group } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import { AgentService } from './agentService';
import { GroupService } from './groupService';
import { WebSocketService } from './webSocketService';
import { ACSService } from './acsService';

export class CallService {
  private calls: Map<string, Call> = new Map();
  private agentService: AgentService;
  private groupService: GroupService;
  private webSocketService: WebSocketService;
  private acsService: ACSService;

  constructor(
    agentService: AgentService, 
    groupService: GroupService,
    webSocketService: WebSocketService
  ) {
    this.agentService = agentService;
    this.groupService = groupService;
    this.webSocketService = webSocketService;
    this.acsService = new ACSService(webSocketService);
    console.log('📞 CallService: Successfully initialized');
  }

  async handleIncomingCall(phoneNumber: string, callerNumber: string, acsEventData?: any): Promise<Call | null> {
    console.log(`📱 CallService: Looking for group with phone number: ${phoneNumber}`);
    
    // Find the group based on the phone number called
    const group = this.groupService.getGroupByPhoneNumber(phoneNumber);
    if (!group) {
      console.error(`❌ CallService: No group found for phone number: ${phoneNumber}`);
      return null;
    }

    console.log(`🎯 CallService: Found group "${group.name}" (${group.id}) for phone number: ${phoneNumber}`);

    // Extract ACS connection info if available
    const acsConnectionInfo = acsEventData ? this.acsService.extractCallConnectionInfo(acsEventData) : {};

    const call: Call = {
      id: uuidv4(),
      phoneNumber: callerNumber,
      groupId: group.id,
      status: CallStatus.INCOMING,
      startTime: new Date(),
      // Store ACS connection info for later use
      acsCallConnectionId: acsConnectionInfo.callConnectionId,
      acsIncomingCallContext: acsConnectionInfo.incomingCallContext
    };

    this.calls.set(call.id, call);
    console.log(`📝 CallService: Created call ${call.id} for caller ${callerNumber}`);
    
    if (acsConnectionInfo.callConnectionId) {
      console.log(`🔗 CallService: Stored ACS connection info for call ${call.id}`);
    }

    // Try to assign the call to an available agent
    const assignedAgent = await this.assignCallToAgent(call);
    
    if (assignedAgent) {
      call.assignedAgentId = assignedAgent.id;
      call.status = CallStatus.RINGING;
      this.calls.set(call.id, call);
      
      console.log(`👤 CallService: Assigned call ${call.id} to agent ${assignedAgent.id} (${assignedAgent.name})`);
      
      // Notify the agent via WebSocket
      this.webSocketService.notifyAgent(assignedAgent.id, 'call_incoming', call);
    } else {
      console.log(`⏳ CallService: No available agents in group ${group.id}, trying overflow routing`);
      // Try overflow groups if enabled
      const overflowSuccess = await this.tryOverflowRouting(call);
      if (!overflowSuccess) {
        console.log(`❌ CallService: No overflow routing available for call ${call.id}`);
      }
    }

    return call;
  }

  private async assignCallToAgent(call: Call): Promise<Agent | null> {
    const availableAgents = this.agentService.getAvailableAgentsByGroup(call.groupId);
    
    console.log(`🔍 CallService: Found ${availableAgents.length} available agents in group ${call.groupId}`);
    
    if (availableAgents.length === 0) {
      return null;
    }

    // Simple round-robin assignment (can be enhanced with more sophisticated algorithms)
    const selectedAgent = availableAgents[0];
    
    console.log(`🎯 CallService: Attempting to assign call ${call.id} to agent ${selectedAgent.id} (${selectedAgent.name})`);
    
    if (this.agentService.assignCallToAgent(selectedAgent.id, call.id)) {
      console.log(`✅ CallService: Successfully assigned call ${call.id} to agent ${selectedAgent.id}`);
      return selectedAgent;
    }

    console.log(`❌ CallService: Failed to assign call ${call.id} to agent ${selectedAgent.id}`);
    return null;
  }

  private async tryOverflowRouting(call: Call): Promise<boolean> {
    const overflowGroups = this.groupService.getAvailableGroups(call.groupId);
    
    console.log(`🔄 CallService: Trying overflow routing for call ${call.id}, found ${overflowGroups.length} overflow groups`);
    
    for (const group of overflowGroups) {
      console.log(`🔍 CallService: Checking overflow group ${group.id} (${group.name})`);
      const availableAgents = this.agentService.getAvailableAgentsByGroup(group.id);
      
      if (availableAgents.length > 0) {
        console.log(`📞 CallService: Found ${availableAgents.length} available agents in overflow group ${group.id}, reassigning call`);
        call.groupId = group.id;
        const assignedAgent = await this.assignCallToAgent(call);
        
        if (assignedAgent) {
          call.assignedAgentId = assignedAgent.id;
          call.status = CallStatus.RINGING;
          this.calls.set(call.id, call);
          
          console.log(`✅ CallService: Successfully routed call ${call.id} to overflow group ${group.id}, agent ${assignedAgent.id}`);
          
          // Notify the agent
          this.webSocketService.notifyAgent(assignedAgent.id, 'call_incoming', call);
          return true;
        }
      } else {
        console.log(`⏭️ CallService: No available agents in overflow group ${group.id}, trying next group`);
      }
    }

    console.log(`❌ CallService: No overflow routing successful for call ${call.id}`);
    return false;
  }

  async answerCall(callId: string, agentId: string): Promise<boolean> {
    const call = this.calls.get(callId);
    
    if (!call || call.assignedAgentId !== agentId || call.status !== CallStatus.RINGING) {
      console.log(`❌ CallService: Cannot answer call ${callId} - invalid state or agent`);
      return false;
    }

    console.log(`📞 CallService: Agent ${agentId} attempting to answer call ${callId}`);

    // Get the agent's ACS user ID (we'll need to store this when the agent logs in)
    const agentData = this.agentService.getAgent(agentId);
    const agentACSUserId = (agentData as any)?.acsUserId;
    
    // First, try to answer the actual ACS call and transfer to agent
    const acsAnswerSuccess = await this.acsService.answerCall(callId, call, agentACSUserId, agentId);
    
    if (!acsAnswerSuccess) {
      console.error(`❌ CallService: Failed to answer ACS call ${callId}`);
      return false;
    }

    // If ACS call was answered successfully, update internal state
    call.status = CallStatus.CONNECTED;
    // Update the call object with any new ACS connection info
    this.calls.set(callId, call);

    // Get the updated agent (status should now be IN_CALL from assignCallToAgent)
    const agent = this.agentService.getAgent(agentId);

    // Update group statistics
    this.groupService.updateGroupStatistics(call.groupId);

    // Notify via WebSocket - both call answered and agent status update
    this.webSocketService.broadcast('call_answered', call);
    if (agent) {
      this.webSocketService.notifyAgent(agentId, 'agent_status_update', agent);
      this.webSocketService.notifySupervisors('agent_status_updated', agent);
    }

    console.log(`✅ CallService: Call ${callId} successfully answered by agent ${agentId}`);
    return true;
  }

  async endCall(callId: string, agentId?: string): Promise<boolean> {
    const call = this.calls.get(callId);
    
    if (!call) {
      console.log(`❌ CallService: Call ${callId} not found`);
      return false;
    }

    // If agent is specified, verify they are assigned to this call
    if (agentId && call.assignedAgentId !== agentId) {
      console.log(`❌ CallService: Agent ${agentId} not authorized to end call ${callId}`);
      return false;
    }

    console.log(`📞 CallService: Attempting to end call ${callId}`);

    // First, try to end the actual ACS call
    const acsEndSuccess = await this.acsService.endCall(callId, call);
    
    if (!acsEndSuccess) {
      console.error(`❌ CallService: Failed to end ACS call ${callId}`);
      return false;
    }

    const assignedAgentId = call.assignedAgentId;
    
    // Update call status and timing
    call.status = CallStatus.ENDED;
    call.endTime = new Date();
    call.duration = call.endTime.getTime() - call.startTime.getTime();

    if (assignedAgentId && call.duration) {
      // Calculate wait time (time from call creation to when it was answered)
      // For ended calls, we assume they were connected at some point
      call.waitTime = 0; // Simplified for now - could track answer timestamp separately

      // Release agent and update statistics
      this.agentService.releaseAgentFromCall(assignedAgentId, call.duration / 1000);
    }

    this.calls.set(callId, call);

    // Get the updated agent (status should now be AVAILABLE from releaseAgentFromCall)
    const agent = assignedAgentId ? this.agentService.getAgent(assignedAgentId) : null;

    // Update group statistics
    this.groupService.updateGroupStatistics(call.groupId);

    // Notify via WebSocket - both call ended and agent status update
    this.webSocketService.broadcast('call_ended', call);
    if (agent && assignedAgentId) {
      this.webSocketService.notifyAgent(assignedAgentId, 'agent_status_update', agent);
      this.webSocketService.notifySupervisors('agent_status_updated', agent);
    }

    console.log(`✅ CallService: Call ${callId} successfully ended`);
    return true;
  }

  getCall(callId: string): Call | undefined {
    return this.calls.get(callId);
  }

  getActiveCalls(): Call[] {
    return Array.from(this.calls.values()).filter(call => 
      call.status !== CallStatus.ENDED
    );
  }

  getCallsByAgent(agentId: string): Call[] {
    return Array.from(this.calls.values()).filter(call => 
      call.assignedAgentId === agentId
    );
  }

  getCallsByGroup(groupId: string): Call[] {
    return Array.from(this.calls.values()).filter(call => 
      call.groupId === groupId
    );
  }

  transferCall(callId: string, fromAgentId: string, toAgentId: string): boolean {
    const call = this.calls.get(callId);
    const toAgent = this.agentService.getAgent(toAgentId);
    
    if (!call || !toAgent || call.assignedAgentId !== fromAgentId || 
        toAgent.status !== 'available') {
      return false;
    }

    // Release current agent
    if (call.duration) {
      this.agentService.releaseAgentFromCall(fromAgentId, call.duration / 1000);
    }

    // Assign to new agent
    if (this.agentService.assignCallToAgent(toAgentId, callId)) {
      call.assignedAgentId = toAgentId;
      call.status = CallStatus.TRANSFERRED;
      this.calls.set(callId, call);

      // Notify both agents
      this.webSocketService.notifyAgent(fromAgentId, 'call_transferred_out', call);
      this.webSocketService.notifyAgent(toAgentId, 'call_transferred_in', call);

      return true;
    }

    return false;
  }

  findCallByACSConnectionId(callConnectionId: string): Call | null {
    for (const call of this.calls.values()) {
      if (call.acsCallConnectionId === callConnectionId) {
        return call;
      }
    }
    return null;
  }
}