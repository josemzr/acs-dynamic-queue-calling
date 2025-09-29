import { CallAutomationClient } from '@azure/communication-call-automation';
import { Call, CallStatus } from '../models/types';
import { WebSocketService } from './webSocketService';

export class ACSService {
  private callAutomationClient: CallAutomationClient | null = null;
  private connectionString: string | null = null;
  private endpoint: string | null = null;
  private webSocketService: WebSocketService | null = null;

  constructor(webSocketService?: WebSocketService) {
    this.webSocketService = webSocketService || null;
    this.connectionString = process.env.ACS_CONNECTION_STRING || null;
    this.endpoint = process.env.ACS_ENDPOINT || null;
    
    console.log('🔧 ACSService: Initializing...');
    console.log('🔧 ACS_CONNECTION_STRING present:', !!this.connectionString);
    console.log('🔧 ACS_ENDPOINT:', this.endpoint);
    
    if (this.connectionString) {
      try {
        this.callAutomationClient = new CallAutomationClient(this.connectionString);
        console.log('✅ ACSService: Initialized with connection string');
      } catch (error) {
        console.error('❌ ACSService: Failed to initialize CallAutomationClient:', error);
      }
    } else {
      console.warn('⚠️ ACSService: No ACS connection string provided - running in mock mode');
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(callId: string, call: Call, agentUserId?: string, agentId?: string): Promise<boolean> {
    console.log(`📞 ACSService: Starting answerCall for ${callId}`);
    console.log(`📞 ACSService: Agent User ID: ${agentUserId || 'not provided'}`);
    console.log(`📞 ACSService: Call object:`, JSON.stringify({
      id: call.id,
      acsIncomingCallContext: call.acsIncomingCallContext ? 'present' : 'missing',
      acsCallConnectionId: call.acsCallConnectionId || 'none'
    }));

    if (!this.callAutomationClient) {
      console.warn('⚠️ ACSService: No ACS client available - mocking answer call');
      return true; // Mock success for development
    }

    try {
      // Check if we have the necessary ACS call information
      if (!call.acsIncomingCallContext) {
        console.error(`❌ ACSService: Missing ACS incoming call context for call ${callId}`);
        console.error(`❌ ACSService: Call object missing context:`, call);
        return false;
      }

      // Check if we're in development mode with localhost callback URL
      const callbackUrl = (process.env.ACS_CALLBACK_BASE_URL || 'http://localhost:3001') + '/api/calls/events';
      console.log(`📞 ACSService: Using callback URL: ${callbackUrl}`);
      
      // In development with localhost, we can't use real ACS callbacks
      if (callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1')) {
        console.log(`⚠️ ACSService: Development mode detected - localhost callback URL not supported by ACS`);
        console.log(`⚠️ ACSService: For full ACS integration, use ngrok or deploy to public endpoint`);
        
        // Simulate successful call answer for development
        call.acsCallConnectionId = `mock-connection-${Date.now()}`;
        console.log(`✅ ACSService: Mock call answer successful - assigned mock connection ID: ${call.acsCallConnectionId}`);
        
        // In mock mode, simulate the transfer to agent by triggering a mock incoming call
        if (agentUserId) {
          console.log(`🔄 ACSService: Mock transfer to agent ${agentUserId}`);
          
          // Simulate an incoming call by making a direct call to the agent's frontend
          // This is a mock behavior - in production, ACS would handle this automatically
          this.simulateIncomingCallToAgent(agentUserId, callId);
        }
        
        return true;
      }
      
      const answerCallResult = await this.callAutomationClient.answerCall(
        call.acsIncomingCallContext,
        callbackUrl
      );

      console.log(`📞 ACSService: Answer call result:`, answerCallResult);

      // Store the call connection ID for future operations
      if (answerCallResult && answerCallResult.callConnection) {
        try {
          // Try different ways to get the connection ID
          const callConnection = answerCallResult.callConnection;
          let callConnectionId = null;
          
          // Method 1: Direct property access (if available)
          if ((callConnection as any).callConnectionId) {
            callConnectionId = (callConnection as any).callConnectionId;
          }
          
          // Method 2: Check if it's in the result somewhere else
          if (!callConnectionId && (answerCallResult as any).callConnectionId) {
            callConnectionId = (answerCallResult as any).callConnectionId;
          }
          
          if (callConnectionId) {
            call.acsCallConnectionId = callConnectionId;
            console.log(`🔗 ACSService: Stored call connection ID: ${call.acsCallConnectionId}`);
            
            // If we have an agent user ID, transfer the call to the agent
            if (agentUserId && call.acsCallConnectionId) {
              console.log(`🔄 ACSService: Transferring call to agent: ${agentUserId}`);
              
              // Wait a moment for the call to fully establish before transferring
              console.log(`⏳ ACSService: Waiting for call to stabilize before transfer...`);
              await new Promise(resolve => setTimeout(resolve, 4000)); // 4 second delay
              
              await this.transferCallToAgent(call.acsCallConnectionId, agentUserId, agentId);
            }
          } else {
            console.warn(`⚠️ ACSService: Could not extract call connection ID from answer result`);
          }
        } catch (extractError) {
          console.error(`❌ ACSService: Error extracting call connection ID:`, extractError);
        }
      }

      console.log(`✅ ACSService: Successfully answered call ${callId}`);
      return true;

    } catch (error) {
      console.error(`❌ ACSService: Failed to answer call ${callId}:`, error);
      if (error instanceof Error) {
        console.error(`❌ ACSService: Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return false;
    }
  }

  /**
   * End/hangup a call
   */
  async endCall(callId: string, call: Call): Promise<boolean> {
    console.log(`📵 ACSService: Starting endCall for ${callId}`);
    console.log(`📵 ACSService: Call object:`, JSON.stringify({
      id: call.id,
      acsCallConnectionId: call.acsCallConnectionId || 'missing',
      status: call.status
    }));

    if (!this.callAutomationClient) {
      console.warn('⚠️ ACSService: No ACS client available - mocking end call');
      return true; // Mock success for development
    }

    try {
      if (!call.acsCallConnectionId) {
        console.log(`🔄 ACSService: No server-side ACS connection for call ${callId} - call is controlled by agent's client-side SDK`);
        console.log(`✅ ACSService: Treating as success since agent controls the call directly`);
        return true;
      }

      console.log(`📵 ACSService: Getting call connection for ID: ${call.acsCallConnectionId}`);
      
      // Check if this is a mock connection (development mode)
      if (call.acsCallConnectionId?.startsWith('mock-connection-')) {
        console.log(`📵 ACSService: Mock call connection detected - simulating hangup`);
        console.log(`✅ ACSService: Mock call hangup successful`);
        return true;
      }
      
      // Get the call connection and hang up
      const callConnection = this.callAutomationClient.getCallConnection(call.acsCallConnectionId);
      
      console.log(`📵 ACSService: Calling hangUp for call ${callId}`);
      await callConnection.hangUp(true); // true = hangup for everyone
      
      console.log(`✅ ACSService: Successfully ended call ${callId}`);
      return true;

    } catch (error) {
      // Check if this is a "Call not found" error, which means the call was already ended
      if (error instanceof Error && (
        error.message.includes('Call not found') || 
        error.message.includes('8522') ||
        (error as any).code === '8522'
      )) {
        console.log(`✅ ACSService: Call ${callId} was already ended (Call not found) - treating as success`);
        return true;
      }
      
      console.error(`❌ ACSService: Failed to end call ${callId}:`, error);
      if (error instanceof Error) {
        console.error(`❌ ACSService: Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return false;
    }
  }

  /**
   * Transfer a call to another phone number
   */
  async transferCall(callId: string, call: Call, targetPhoneNumber: string): Promise<boolean> {
    if (!this.callAutomationClient) {
      console.warn('⚠️ ACSService: No ACS client available - mocking transfer call');
      return true; // Mock success for development
    }

    try {
      console.log(`📞 ACSService: Attempting to transfer call ${callId} to ${targetPhoneNumber}`);
      
      if (!call.acsCallConnectionId) {
        console.error(`❌ ACSService: No ACS call connection ID found for call ${callId}`);
        return false;
      }

      const callConnection = this.callAutomationClient.getCallConnection(call.acsCallConnectionId);
      
      // Transfer the call - create proper phone number identifier
      const phoneNumberIdentifier = { phoneNumber: targetPhoneNumber };
      
      await callConnection.transferCallToParticipant(phoneNumberIdentifier);

      console.log(`✅ ACSService: Successfully initiated transfer for call ${callId}`);
      return true;

    } catch (error) {
      console.error(`❌ ACSService: Failed to transfer call ${callId}:`, error);
      return false;
    }
  }

  /**
   * Check if ACS service is properly configured
   */
  isConfigured(): boolean {
    return this.callAutomationClient !== null;
  }

  /**
   * Transfer a call to an agent's ACS identity
   */
  async transferCallToAgent(callConnectionId: string, agentUserId: string, agentId?: string): Promise<boolean> {
    if (!this.callAutomationClient) {
      console.warn('⚠️ ACSService: No ACS client available - mocking transfer');
      return true;
    }

    try {
      console.log(`🔄 ACSService: Transferring call ${callConnectionId} to agent ${agentUserId}`);
      
      const callConnection = this.callAutomationClient.getCallConnection(callConnectionId);
      
      // Create the ACS user identifier for the agent
      const agentIdentifier = { communicationUserId: agentUserId };
      
      // Transfer the call to the agent
      await callConnection.transferCallToParticipant(agentIdentifier);
      
      // Notify the frontend via WebSocket that a call transfer is happening
      if (this.webSocketService && agentId) {
        console.log(`📡 ACSService: Notifying agent ${agentId} of incoming ACS call transfer`);
        this.webSocketService.notifyAgent(agentId, 'acs_call_transfer_incoming', {
          callConnectionId,
          agentUserId,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ ACSService: Call transferred to agent ${agentUserId}`);
      return true;

    } catch (error) {
      console.error(`❌ ACSService: Failed to transfer call to agent:`, error);
      return false;
    }
  }

  /**
   * Simulate incoming call to agent (for mock/development mode only)
   */
  private async simulateIncomingCallToAgent(agentUserId: string, callId: string): Promise<void> {
    try {
      console.log(`🎭 ACSService: Simulating incoming call to agent ${agentUserId} for call ${callId}`);
      
      // In a real scenario, this would be handled by ACS SDK automatically
      // For development, we'll use a webhook or direct notification approach
      
      // Option 1: We could use WebSocket to notify the frontend directly
      // Option 2: We could use a webhook simulation
      // Option 3: We could make a direct HTTP call to the frontend
      
      // For now, just log the simulation - the frontend will need to handle this differently
      console.log(`🎭 ACSService: In development mode, the frontend ACS Calling SDK won't receive`);
      console.log(`🎭 ACSService: incoming calls automatically. Consider implementing a mock trigger.`);
      
      // We might need to use WebSocket service to notify the agent directly
      // const webSocketService = WebSocketService.getInstance();
      // webSocketService.notifyAgent(agentId, 'acs_incoming_call_simulation', { callId, agentUserId });
      
    } catch (error) {
      console.error('❌ ACSService: Failed to simulate incoming call:', error);
    }
  }

  /**
   * Extract agent ID from ACS user ID
   * ACS user IDs are stored with a mapping to agent IDs, so we need to look it up
   */
  private extractAgentIdFromACSUserId(acsUserId: string): string | null {
    // For now, we'll need to get this from the agent service
    // This is a simplified approach - in a real system, you'd have a proper mapping
    // The agent ID should be passed from the calling service
    return null; // Will be handled by the calling service passing the agent ID directly
  }

  /**
   * Extract ACS connection info from incoming call webhook data
   */
  extractCallConnectionInfo(eventData: any): { callConnectionId?: string; incomingCallContext?: string } {
    try {
      // Extract from EventGrid ACS incoming call event
      // The incoming call context should be available in the event data
      let callConnectionId = eventData.callConnectionId;
      let incomingCallContext = eventData.incomingCallContext;
      
      // If not directly available, try other possible locations in the event structure
      if (!incomingCallContext) {
        // Sometimes the context is nested differently
        incomingCallContext = eventData.data?.incomingCallContext || 
                             eventData.subject?.incomingCallContext ||
                             eventData.eventGridEvent?.data?.incomingCallContext;
      }
      
      console.log(`🔍 ACSService: Extracted - callConnectionId: ${callConnectionId}, incomingCallContext present: ${!!incomingCallContext}`);
      
      return {
        callConnectionId,
        incomingCallContext
      };
    } catch (error) {
      console.error('❌ ACSService: Failed to extract call connection info:', error);
      return {};
    }
  }
}