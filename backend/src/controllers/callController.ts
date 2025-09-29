import { Request, Response } from 'express';
import { CallService } from '../services/callService';
import { WebSocketService } from '../services/webSocketService';
import { ApiResponse, CallStatus } from '../models/types';

export class CallController {
  private callService: CallService;
  private webSocketService: WebSocketService;

  constructor(callService: CallService, webSocketService: WebSocketService) {
    this.callService = callService;
    this.webSocketService = webSocketService;
  }

  // Webhook endpoint for incoming calls from ACS
  handleIncomingCall = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).webhookRequestId || 'unknown';
    
    try {
      console.log(`🎯 [${requestId}] Processing incoming call webhook`);
      
      // Handle EventGrid events (both validation and actual calls)
      if (Array.isArray(req.body) && req.body.length > 0) {
        const event = req.body[0];
        
        // Handle EventGrid subscription validation
        if (event.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
          console.log(`🔐 [${requestId}] Handling EventGrid subscription validation`);
          const validationCode = event.data?.validationCode;
          
          if (validationCode) {
            console.log(`✅ [${requestId}] Returning validation code: ${validationCode}`);
            const validationResponse = {
              validationResponse: validationCode
            };
            res.status(200).json(validationResponse);
            return;
          } else {
            console.log(`❌ [${requestId}] Missing validation code in validation event`);
            res.status(400).json({ error: 'Missing validation code' });
            return;
          }
        }
        
        // Handle ACS incoming call events
        if (event.eventType === 'Microsoft.Communication.IncomingCall') {
          console.log(`📞 [${requestId}] Handling ACS incoming call event`);
          const callData = event.data;
          
          if (!callData) {
            console.log(`❌ [${requestId}] Missing call data in incoming call event`);
            const response: ApiResponse<null> = {
              success: false,
              error: 'Missing call data in incoming call event'
            };
            res.status(400).json(response);
            return;
          }
          
          // Extract phone numbers from ACS event structure
          const phoneNumber = callData.to?.phoneNumber?.value;
          const callerNumber = callData.from?.phoneNumber?.value;
          
          if (!phoneNumber || !callerNumber) {
            console.log(`❌ [${requestId}] Missing required fields in ACS event - phoneNumber: ${phoneNumber}, callerNumber: ${callerNumber}`);
            const response: ApiResponse<null> = {
              success: false,
              error: 'Missing required phone number fields in ACS event'
            };
            res.status(400).json(response);
            return;
          }
          
          console.log(`📞 [${requestId}] Extracted phone numbers - to: ${phoneNumber}, from: ${callerNumber}`);
          
          // Process the call with extracted phone numbers and ACS event data
          const call = await this.callService.handleIncomingCall(phoneNumber, callerNumber, callData);

          if (!call) {
            console.log(`❌ [${requestId}] Failed to create call - no group found for phone number ${phoneNumber}`);
            const response: ApiResponse<null> = {
              success: false,
              error: 'No group found for phone number or failed to create call'
            };
            res.status(404).json(response);
            return;
          }

          console.log(`✅ [${requestId}] Call created successfully - callId: ${call.id}, groupId: ${call.groupId}, status: ${call.status}`);
          
          const response: ApiResponse<typeof call> = {
            success: true,
            data: call,
            message: 'Call handled successfully'
          };
          
          res.json(response);
          return;
        }
      }
      
      // Handle legacy direct call format (for backward compatibility)
      console.log(`📞 [${requestId}] Processing legacy direct call format`);
      const { phoneNumber, callerNumber } = req.body;

      if (!phoneNumber || !callerNumber) {
        console.log(`❌ [${requestId}] Missing required fields - phoneNumber: ${phoneNumber}, callerNumber: ${callerNumber}`);
        const response: ApiResponse<null> = {
          success: false,
          error: 'Missing required fields: phoneNumber, callerNumber'
        };
        res.status(400).json(response);
        return;
      }

      console.log(`📞 [${requestId}] Handling incoming call from ${callerNumber} to ${phoneNumber}`);
      
      const call = await this.callService.handleIncomingCall(phoneNumber, callerNumber);

      if (!call) {
        console.log(`❌ [${requestId}] Failed to create call - no group found for phone number ${phoneNumber}`);
        const response: ApiResponse<null> = {
          success: false,
          error: 'No group found for phone number or failed to create call'
        };
        res.status(404).json(response);
        return;
      }

      console.log(`✅ [${requestId}] Call created successfully - callId: ${call.id}, groupId: ${call.groupId}, status: ${call.status}`);
      
      const response: ApiResponse<typeof call> = {
        success: true,
        data: call,
        message: 'Call handled successfully'
      };
      
      res.json(response);
    } catch (error) {
      console.error(`💥 [${requestId}] Error handling incoming call:`, error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  answerCall = async (req: Request, res: Response): Promise<void> => {
    try {
      const { callId } = req.params;
      const { agentId } = req.body;

      if (!agentId) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Missing required field: agentId'
        };
        res.status(400).json(response);
        return;
      }

      const success = await this.callService.answerCall(callId, agentId);

      if (!success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Failed to answer call. Call not found, not assigned to agent, or ACS operation failed.'
        };
        res.status(400).json(response);
        return;
      }

      const call = this.callService.getCall(callId);

      const response: ApiResponse<typeof call> = {
        success: true,
        data: call,
        message: 'Call answered successfully'
      };
      
      res.json(response);
    } catch (error) {
      console.error('❌ CallController: Error answering call:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  endCall = async (req: Request, res: Response): Promise<void> => {
    try {
      const { callId } = req.params;
      const { agentId } = req.body;

      const success = await this.callService.endCall(callId, agentId);

      if (!success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Failed to end call. Call not found or ACS operation failed.'
        };
        res.status(404).json(response);
        return;
      }

      const call = this.callService.getCall(callId);

      const response: ApiResponse<typeof call> = {
        success: true,
        data: call,
        message: 'Call ended successfully'
      };
      
      res.json(response);
    } catch (error) {
      console.error('❌ CallController: Error ending call:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  transferCall = (req: Request, res: Response): void => {
    try {
      const { callId } = req.params;
      const { fromAgentId, toAgentId } = req.body;

      if (!fromAgentId || !toAgentId) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Missing required fields: fromAgentId, toAgentId'
        };
        res.status(400).json(response);
        return;
      }

      const success = this.callService.transferCall(callId, fromAgentId, toAgentId);

      if (!success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Failed to transfer call. Call not found or agent not available.'
        };
        res.status(400).json(response);
        return;
      }

      const call = this.callService.getCall(callId);

      const response: ApiResponse<typeof call> = {
        success: true,
        data: call,
        message: 'Call transferred successfully'
      };
      
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  getCall = (req: Request, res: Response): void => {
    try {
      const { callId } = req.params;
      const call = this.callService.getCall(callId);

      if (!call) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Call not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof call> = {
        success: true,
        data: call
      };
      
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  getActiveCalls = (req: Request, res: Response): void => {
    try {
      const calls = this.callService.getActiveCalls();
      
      const response: ApiResponse<typeof calls> = {
        success: true,
        data: calls
      };
      
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  getCallsByAgent = (req: Request, res: Response): void => {
    try {
      const { agentId } = req.params;
      const calls = this.callService.getCallsByAgent(agentId);
      
      const response: ApiResponse<typeof calls> = {
        success: true,
        data: calls
      };
      
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  getCallsByGroup = (req: Request, res: Response): void => {
    try {
      const { groupId } = req.params;
      const calls = this.callService.getCallsByGroup(groupId);
      
      const response: ApiResponse<typeof calls> = {
        success: true,
        data: calls
      };
      
      res.json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  // Handle ACS Call Automation events
  handleACSCallEvents = async (req: Request, res: Response): Promise<void> => {
    const requestId = (req as any).webhookRequestId || 'unknown';
    
    try {
      console.log(`🎯 [${requestId}] Processing ACS call automation event`);
      
      // Handle EventGrid events for call automation
      if (Array.isArray(req.body) && req.body.length > 0) {
        for (const event of req.body) {
          console.log(`📞 [${requestId}] Processing event - eventType: ${event.eventType}, type: ${event.type}`);
          
          // Handle EventGrid subscription validation
          if (event.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
            console.log(`🔐 [${requestId}] Handling EventGrid subscription validation`);
            const validationCode = event.data?.validationCode;
            
            if (validationCode) {
              console.log(`✅ [${requestId}] Returning validation code: ${validationCode}`);
              const validationResponse = {
                validationResponse: validationCode
              };
              res.status(200).json(validationResponse);
              return;
            }
          }
          
          // Handle call automation events
          await this.processCallAutomationEvent(event, requestId);
        }
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error(`💥 [${requestId}] Error handling ACS call events:`, error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  private async processCallAutomationEvent(event: any, requestId: string): Promise<void> {
    const eventType = event.eventType || event.type;
    const eventData = event.data;
    
    console.log(`📞 [${requestId}] Processing call automation event: ${eventType}`);
    
    try {
      switch (eventType) {
        case 'Microsoft.Communication.CallConnected':
          await this.handleCallConnectedEvent(eventData, requestId);
          break;
        case 'Microsoft.Communication.CallDisconnected':
          await this.handleCallDisconnectedEvent(eventData, requestId);
          break;
        case 'Microsoft.Communication.CallTransferAccepted':
        case 'Microsoft.Communication.CallTransferFailed':
          await this.handleCallTransferEvent(eventData, requestId);
          break;
        default:
          console.log(`ℹ️ [${requestId}] Unhandled event type: ${eventType}`);
      }
    } catch (error) {
      console.error(`❌ [${requestId}] Error processing event ${eventType}:`, error);
    }
  }

  private async handleCallConnectedEvent(eventData: any, requestId: string): Promise<void> {
    console.log(`✅ [${requestId}] Call connected event received`);
    
    const callConnectionId = eventData.callConnectionId;
    if (callConnectionId) {
      // Find the call by ACS connection ID and update its status
      const call = this.callService.findCallByACSConnectionId(callConnectionId);
      if (call) {
        console.log(`✅ [${requestId}] Found call ${call.id} for connection ${callConnectionId}`);
        // The call should already be in CONNECTED status from answerCall, but ensure consistency
        call.status = CallStatus.CONNECTED;
        this.webSocketService.broadcast('call_connected', call);
      }
    }
  }

  private async handleCallDisconnectedEvent(eventData: any, requestId: string): Promise<void> {
    console.log(`📵 [${requestId}] Call disconnected event received`);
    console.log(`📵 [${requestId}] Event data:`, JSON.stringify(eventData, null, 2));
    
    const callConnectionId = eventData.callConnectionId;
    const disconnectMessage = eventData.resultInformation?.message || '';
    const subCode = eventData.resultInformation?.subCode;
    
    console.log(`📵 [${requestId}] Looking for call with connection ID: ${callConnectionId}`);
    console.log(`📵 [${requestId}] Disconnect message: "${disconnectMessage}", subCode: ${subCode}`);
    
    // Check if this is a transfer-related disconnect
    const isTransferDisconnect = disconnectMessage.includes('transfer completed successfully') || subCode === 7015;
    
    if (isTransferDisconnect) {
      console.log(`🔄 [${requestId}] This is a transfer-related disconnect - NOT ending call in our system`);
      return;
    }
    
    if (callConnectionId) {
      // Find the call by ACS connection ID and end it
      const call = this.callService.findCallByACSConnectionId(callConnectionId);
      console.log(`📵 [${requestId}] Found call:`, call ? `${call.id} (status: ${call.status})` : 'null');
      
      if (call && call.status !== CallStatus.ENDED) {
        console.log(`📵 [${requestId}] Ending call ${call.id} due to genuine ACS disconnect event`);
        try {
          await this.callService.endCall(call.id);
          console.log(`✅ [${requestId}] Successfully ended call ${call.id} from disconnect event`);
        } catch (error) {
          console.error(`❌ [${requestId}] Failed to end call ${call.id}:`, error);
        }
      } else if (call && call.status === CallStatus.ENDED) {
        console.log(`ℹ️ [${requestId}] Call ${call.id} already ended, skipping`);
      }
    } else {
      console.warn(`⚠️ [${requestId}] No call connection ID found in disconnect event`);
    }
  }

  private async handleCallTransferEvent(eventData: any, requestId: string): Promise<void> {
    console.log(`🔄 [${requestId}] Call transfer event received`);
    console.log(`🔄 [${requestId}] Event data:`, JSON.stringify(eventData, null, 2));
    
    const callConnectionId = eventData.callConnectionId;
    
    if (callConnectionId) {
      // Find the call by ACS connection ID
      const call = this.callService.findCallByACSConnectionId(callConnectionId);
      console.log(`🔄 [${requestId}] Found call:`, call ? `${call.id} (status: ${call.status})` : 'null');
      
      if (call) {
        console.log(`🔄 [${requestId}] Transfer completed for call ${call.id} - clearing server-side ACS connection`);
        
        // Clear the ACS connection ID since the call is now transferred to the agent's client-side connection
        // The agent will handle the call through their ACS Calling SDK
        call.acsCallConnectionId = undefined;
        
        console.log(`✅ [${requestId}] Call ${call.id} transfer handled - agent now controls the call`);
      }
    } else {
      console.warn(`⚠️ [${requestId}] No call connection ID found in transfer event`);
    }
  }

  // Get ACS token for agent calling
  getACSToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { agentId } = req.params;
      console.log(`🔑 ACS Token request for agent: ${agentId}`);
      
      if (!agentId) {
        console.error('❌ Missing agent ID in token request');
        const response: ApiResponse<null> = {
          success: false,
          error: 'Agent ID is required'
        };
        res.status(400).json(response);
        return;
      }

      const connectionString = process.env.ACS_CONNECTION_STRING;
      console.log('🔑 ACS Connection String present:', !!connectionString);
      
      if (!connectionString) {
        console.error('❌ ACS connection string not configured');
        const response: ApiResponse<null> = {
          success: false,
          error: 'ACS connection string not configured'
        };
        res.status(500).json(response);
        return;
      }

      console.log('🔑 Creating ACS Identity Client...');
      const { CommunicationIdentityClient } = require('@azure/communication-identity');
      const identityClient = new CommunicationIdentityClient(connectionString);
      
      console.log('🔑 Creating user identity...');
      const user = await identityClient.createUser();
      console.log('🔑 User created:', user.communicationUserId);
      
      console.log('🔑 Generating token with voip scope...');
      const tokenResponse = await identityClient.getToken(user, ['voip']);
      console.log('🔑 Token generated successfully, length:', tokenResponse.token.length);
      
      const tokenInfo = {
        userId: user.communicationUserId,
        token: tokenResponse.token,
        expiresOn: tokenResponse.expiresOn
      };

      const response: ApiResponse<typeof tokenInfo> = {
        success: true,
        data: tokenInfo,
        message: 'ACS token generated successfully'
      };
      
      console.log('✅ ACS token response sent successfully');
      res.json(response);
    } catch (error) {
      console.error('❌ CallController: Error generating ACS token:', error);
      if (error instanceof Error) {
        console.error('❌ Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      const response: ApiResponse<null> = {
        success: false,
        error: `Failed to generate ACS token: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      res.status(500).json(response);
    }
  };

  // Debug endpoint to test ACS configuration
  testACSConnection = (req: Request, res: Response): void => {
    try {
      const acsService = new (require('../services/acsService').ACSService)();
      const callbackUrl = (process.env.ACS_CALLBACK_BASE_URL || 'http://localhost:3001') + '/api/calls/events';
      const isLocalhost = callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1');
      
      const connectionInfo = {
        isConfigured: acsService.isConfigured(),
        connectionString: !!process.env.ACS_CONNECTION_STRING,
        endpoint: process.env.ACS_ENDPOINT || 'not set',
        callbackUrl: callbackUrl,
        isLocalhostCallback: isLocalhost,
        developmentMode: isLocalhost,
        recommendations: isLocalhost ? [
          'Use ngrok to expose localhost publicly for full ACS integration',
          'Run: ngrok http 3001, then update ACS_CALLBACK_BASE_URL in .env',
          'Current setup will work in mock mode for UI testing'
        ] : [
          'Configuration looks good for production ACS integration',
          'Ensure the callback URL is publicly accessible via HTTPS'
        ]
      };

      const response: ApiResponse<typeof connectionInfo> = {
        success: true,
        data: connectionInfo,
        message: isLocalhost ? 'ACS running in development/mock mode' : 'ACS configuration ready for production'
      };
      
      res.json(response);
    } catch (error) {
      console.error('❌ CallController: Error testing ACS connection:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Failed to test ACS connection'
      };
      res.status(500).json(response);
    }
  };
}