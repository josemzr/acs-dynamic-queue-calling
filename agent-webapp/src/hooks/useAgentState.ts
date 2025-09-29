import { useState, useEffect, useCallback, useRef } from 'react';
import { Agent, AgentStatus, Call, WebSocketMessage } from '../types';
import { ApiService } from '../services/apiService';
import { WebSocketService } from '../services/webSocketService';
import { ACSCallingService, CallInfo } from '../services/acsCallingService';
import { IncomingCall } from '@azure/communication-calling';

export interface UseAgentStateReturn {
  agent: Agent | null;
  currentCall: Call | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  isMuted: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateStatus: (status: AgentStatus) => Promise<boolean>;
  answerCall: (callId: string) => Promise<boolean>;
  endCall: (callId: string) => Promise<boolean>;
  toggleMute: () => Promise<boolean>;
}

export const useAgentState = (): UseAgentStateReturn => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const apiService = ApiService.getInstance();
  const wsService = WebSocketService.getInstance();
  const acsCallingServiceRef = useRef<ACSCallingService | null>(null);
  const currentIncomingCallRef = useRef<IncomingCall | null>(null);

  // WebSocket event handlers
  // Initialize ACS Calling Service when agent is available
  const initializeACSCalling = useCallback(async (agentData: Agent) => {
    try {
      console.log('🎤 Initializing ACS Calling Service for agent:', agentData.name);
      
      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        console.error('❌ ACS Calling SDK requires HTTPS or localhost');
        setError('Voice calling requires secure connection (HTTPS)');
        return;
      }

      // Get ACS token from backend
      console.log('🔑 Requesting ACS token...');
      const tokenResponse = await apiService.getACSToken(agentData.id);
      console.log('🔑 Token response:', tokenResponse);
      
      if (!tokenResponse.success || !tokenResponse.data) {
        console.error('❌ Failed to get ACS token:', tokenResponse.error);
        setError(`Failed to get voice calling token: ${tokenResponse.error}`);
        return;
      }

      console.log('✅ ACS token received, initializing calling service...');

      // Store the ACS user ID in the agent data (send to backend)
      const updateAgentResponse = await apiService.updateAgentACSUserId(agentData.id, tokenResponse.data.userId);
      if (!updateAgentResponse.success) {
        console.warn('⚠️ Failed to update agent ACS user ID:', updateAgentResponse.error);
      }

      // Initialize ACS calling service
      const acsService = new ACSCallingService();
      const initSuccess = await acsService.initialize({
        userId: tokenResponse.data.userId,
        displayName: agentData.name,
        token: tokenResponse.data.token
      });

      if (initSuccess) {
        acsCallingServiceRef.current = acsService;
        
        // Set up ACS event handlers
        acsService.onIncomingCall(async (incomingCall) => {
          console.log('📞 ACS Incoming call received:', incomingCall.id);
          console.log('🔄 This is likely a transferred call from server - auto-accepting...');
          
          // Automatically accept transferred calls (these come from our call transfer)
          try {
            const acceptSuccess = await acsService.answerCall(incomingCall);
            if (acceptSuccess) {
              console.log('✅ ACS transferred call accepted - audio should be connected');
              currentIncomingCallRef.current = null; // Clear since it's now active
            } else {
              console.error('❌ Failed to accept ACS transferred call');
              currentIncomingCallRef.current = incomingCall; // Keep for manual handling
            }
          } catch (error) {
            console.error('❌ Error accepting ACS transferred call:', error);
            currentIncomingCallRef.current = incomingCall;
          }
          
          // Show notification for ACS call
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Voice Call Connected', {
              body: `Audio connection established`,
              icon: '/favicon.ico',
            });
          }
        });

        acsService.onCallStateChanged((callInfo) => {
          console.log('🔄 ACS Call state changed:', callInfo.state);
        });

        acsService.onCallEnded((reason) => {
          console.log('📵 ACS Call ended:', reason);
          currentIncomingCallRef.current = null;
        });

        console.log('✅ ACS Calling Service initialized successfully');
      } else {
        console.error('❌ ACS Calling Service initialization failed');
        setError('Failed to initialize voice calling service');
      }
    } catch (error) {
      console.error('❌ Failed to initialize ACS calling:', error);
      if (error instanceof Error) {
        console.error('❌ Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        setError(`Voice calling initialization failed: ${error.message}`);
      } else {
        setError('Failed to initialize voice calling');
      }
    }
  }, [apiService]);

  const handleCallIncoming = useCallback((message: WebSocketMessage) => {
    const call = message.data as Call;
    setCurrentCall(call);
    setError(null);
    
    // Show notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Incoming Call', {
        body: `Call from ${call.phoneNumber}`,
        icon: '/favicon.ico',
      });
    }
  }, []);

  const handleCallEnded = useCallback((message: WebSocketMessage) => {
    const call = message.data as Call;
    if (currentCall?.id === call.id) {
      setCurrentCall(null);
    }
  }, [currentCall]);

  const handleCallAnswered = useCallback((message: WebSocketMessage) => {
    const call = message.data as Call;
    if (currentCall?.id === call.id) {
      setCurrentCall(call);
    }
  }, [currentCall]);

  const handleAgentStatusUpdate = useCallback((message: WebSocketMessage) => {
    const updatedAgent = message.data as Agent;
    if (agent && updatedAgent.id === agent.id) {
      setAgent(updatedAgent);
    }
  }, [agent]);

  const handleConnected = useCallback(() => {
    setIsConnected(true);
    setError(null);
  }, []);

  const handleDisconnected = useCallback(() => {
    setIsConnected(false);
  }, []);

  const handleConnectionFailed = useCallback(() => {
    setError('Failed to connect to server');
    setIsConnected(false);
  }, []);

  const handleACSCallTransferIncoming = useCallback((message: WebSocketMessage) => {
    console.log('📡 Received ACS call transfer notification:', message.data);
    
    const acsService = acsCallingServiceRef.current;
    if (acsService) {
      console.log('🎯 Simulating ACS incoming call for transfer');
      
      // Simulate an incoming call since ACS transfer won't work with localhost
      setTimeout(async () => {
        try {
          console.log('🎭 Creating simulated ACS incoming call for transfer...');
          
          // Create a mock incoming call object
          const mockIncomingCall = {
            id: `transferred-call-${Date.now()}`,
            callerInfo: { phoneNumber: message.data?.phoneNumber || 'transferred-call' },
            accept: async (options: any) => {
              console.log('🎭 Mock transferred call accepted with options:', options);
              console.log('🎤 Using existing persistent audio stream - no new audio requests');
              
              // Create a mock ACS call object that doesn't interfere with audio
              const mockCall = {
                id: `mock-transferred-${Date.now()}`,
                state: 'Connecting',
                direction: 'Incoming' as const,
                isMuted: false,
                remoteParticipants: [],
                mute: async () => { 
                  (mockCall as any).isMuted = true; 
                  console.log('🔇 Mock transferred call muted'); 
                  return true;
                },
                unmute: async () => { 
                  (mockCall as any).isMuted = false; 
                  console.log('🎤 Mock transferred call unmuted'); 
                  return true;
                },
                hangUp: async () => { 
                  (mockCall as any).state = 'Disconnected'; 
                  console.log('📵 Mock transferred call hung up'); 
                },
                on: (event: string, handler: any) => {
                  console.log(`� Mock transferred call event listener added: ${event}`);
                  if (event === 'stateChanged') {
                    setTimeout(() => {
                      (mockCall as any).state = 'Connected';
                      console.log('🎭 Mock transferred call state changed to Connected');
                      handler();
                    }, 1000);
                  }
                }
              };
              
              return mockCall;
            }
          } as any;
          
          // Auto-accept the mock transferred call
          const acceptSuccess = await acsService.answerCall(mockIncomingCall);
          if (acceptSuccess) {
            console.log('✅ Mock ACS transferred call accepted - audio simulation connected');
          } else {
            console.error('❌ Failed to accept mock ACS transferred call');
          }
        } catch (error) {
          console.error('❌ Error simulating ACS transferred call:', error);
        }
      }, 500); // Small delay to ensure call transfer is processed
    }
  }, []);

  // Setup WebSocket event listeners
  useEffect(() => {
    wsService.on('call_incoming', handleCallIncoming);
    wsService.on('call_ended', handleCallEnded);
    wsService.on('call_answered', handleCallAnswered);
    wsService.on('agent_status_update', handleAgentStatusUpdate);
    wsService.on('acs_call_transfer_incoming', handleACSCallTransferIncoming);
    wsService.on('connected', handleConnected);
    wsService.on('disconnected', handleDisconnected);
    wsService.on('connection_failed', handleConnectionFailed);

    return () => {
      wsService.off('call_incoming', handleCallIncoming);
      wsService.off('call_ended', handleCallEnded);
      wsService.off('call_answered', handleCallAnswered);
      wsService.off('agent_status_update', handleAgentStatusUpdate);
      wsService.off('acs_call_transfer_incoming', handleACSCallTransferIncoming);
      wsService.off('connected', handleConnected);
      wsService.off('disconnected', handleDisconnected);
      wsService.off('connection_failed', handleConnectionFailed);
    };
  }, [
    handleCallIncoming,
    handleCallEnded,
    handleCallAnswered,
    handleAgentStatusUpdate,
    handleACSCallTransferIncoming,
    handleConnected,
    handleDisconnected,
    handleConnectionFailed,
    wsService,
  ]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Authenticate agent with username/password
      const response = await apiService.login(username, password);
      
      if (response.success && response.data) {
        const agent = response.data.agent;
        setAgent(agent);
        
        // Connect to WebSocket
        wsService.connect(agent.id);
        
        // Initialize ACS Calling Service
        await initializeACSCalling(agent);
        
        // Update status to available
        const statusResponse = await apiService.updateAgentStatus(agent.id, AgentStatus.AVAILABLE);
        if (statusResponse.success && statusResponse.data) {
          setAgent(statusResponse.data);
        }
        
        setIsLoading(false);
        return true;
      } else {
        setError(response.error || 'Failed to login');
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      setError('Network error during login');
      setIsLoading(false);
      return false;
    }
  }, [apiService, wsService, initializeACSCalling]);

  const logout = useCallback(async () => {
    if (agent) {
      // Don't wait for the status update, just disconnect
      apiService.updateAgentStatus(agent.id, AgentStatus.OFFLINE);
    }
    
    // Clean up ACS calling service
    const acsService = acsCallingServiceRef.current;
    if (acsService) {
      await acsService.dispose();
      acsCallingServiceRef.current = null;
    }
    
    wsService.disconnect();
    setAgent(null);
    setCurrentCall(null);
    setIsConnected(false);
    setError(null);
    currentIncomingCallRef.current = null;
  }, [agent, apiService, wsService]);

  const updateStatus = useCallback(async (status: AgentStatus): Promise<boolean> => {
    if (!agent) return false;

    try {
      const response = await apiService.updateAgentStatus(agent.id, status);
      
      if (response.success && response.data) {
        setAgent(response.data);
        return true;
      } else {
        setError(response.error || 'Failed to update status');
        return false;
      }
    } catch (err) {
      setError('Network error updating status');
      return false;
    }
  }, [agent, apiService]);

  const answerCall = useCallback(async (callId: string): Promise<boolean> => {
    if (!agent) return false;

    try {
      // First, answer the call on the server side (for queue management)
      console.log('📞 Answering call on server side:', callId);
      const response = await apiService.answerCall(callId, agent.id);
      
      if (response.success && response.data) {
        setCurrentCall(response.data);
        
        // The server-side call control now includes call transfer to the agent
        // When the call is answered, ACS should transfer the call to the agent's identity
        console.log('✅ Call answered successfully - call should be transferred to agent');
        console.log('🔄 ACS call transfer initiated - agent should receive incoming call');
        
        // In development mode (localhost), simulate the incoming ACS call
        // since real ACS transfer won't work with localhost callbacks
        const acsService = acsCallingServiceRef.current;
        if (acsService && window.location.hostname === 'localhost' && response.data) {
          console.log('🎭 Development mode: Simulating ACS incoming call...');
          
          // Simulate an incoming call in development mode
          setTimeout(async () => {
            try {
              console.log('🎭 Creating mock incoming call for development...');
              
              // Create a mock incoming call object
              const mockIncomingCall = {
                id: `mock-incoming-${Date.now()}`,
                callerInfo: { phoneNumber: response.data?.phoneNumber || 'unknown' },
                accept: async (options: any) => {
                  console.log('🎭 Mock incoming call accepted with options:', options);
                  
                  // Create a mock ACS call object
                  const mockCall = {
                    id: `mock-call-${Date.now()}`,
                    state: 'Connecting',
                    direction: 'Incoming' as const,
                    isMuted: false,
                    remoteParticipants: [],
                    mute: async () => { 
                      (mockCall as any).isMuted = true; 
                      console.log('🔇 Mock call muted'); 
                    },
                    unmute: async () => { 
                      (mockCall as any).isMuted = false; 
                      console.log('🎤 Mock call unmuted'); 
                    },
                    hangUp: async () => { 
                      (mockCall as any).state = 'Disconnected'; 
                      console.log('📵 Mock call hung up'); 
                    },
                    on: (event: string, handler: any) => {
                      console.log(`🎭 Mock call event listener added: ${event}`);
                      // Simulate state change to Connected after a short delay
                      if (event === 'stateChanged') {
                        setTimeout(() => {
                          (mockCall as any).state = 'Connected';
                          console.log('🎭 Mock call state changed to Connected');
                          handler();
                        }, 1000);
                      }
                    }
                  };
                  
                  return mockCall;
                }
              } as any;
              
              // Auto-accept the mock incoming call
              const acceptSuccess = await acsService.answerCall(mockIncomingCall);
              if (acceptSuccess) {
                console.log('✅ Mock ACS call accepted - audio simulation connected');
              } else {
                console.error('❌ Failed to accept mock ACS call');
              }
            } catch (error) {
              console.error('❌ Error simulating incoming ACS call:', error);
            }
          }, 500); // Small delay to simulate transfer time
        }
        
        // Clear any previous ACS availability errors since the functionality is implemented
        if (error && error.includes('ACS not available')) {
          setError(null);
        }
        
        return true;
      } else {
        setError(response.error || 'Failed to answer call');
        return false;
      }
    } catch (err) {
      setError('Network error answering call');
      return false;
    }
  }, [agent, apiService, error]);

  const endCall = useCallback(async (callId: string): Promise<boolean> => {
    if (!agent) return false;

    try {
      // First, end the ACS call if available
      const acsService = acsCallingServiceRef.current;
      if (acsService && acsService.hasActiveCall()) {
        console.log('📵 Ending ACS call');
        await acsService.endCall();
      }
      
      // Then, end the call on the server side
      console.log('📵 Ending call on server side:', callId);
      const response = await apiService.endCall(callId, agent.id);
      
      if (response.success) {
        setCurrentCall(null);
        currentIncomingCallRef.current = null;
        console.log('✅ Call ended successfully');
        return true;
      } else {
        setError(response.error || 'Failed to end call');
        return false;
      }
    } catch (err) {
      setError('Network error ending call');
      return false;
    }
  }, [agent, apiService]);

  const toggleMute = useCallback(async (): Promise<boolean> => {
    const acsService = acsCallingServiceRef.current;
    if (!acsService) {
      setError('Voice calling not available');
      return false;
    }

    // Check if there's an active call
    if (!acsService.hasActiveCall()) {
      console.warn('⚠️ No active ACS call - call transfer might still be in progress');
      setError('No active audio call - transfer may still be connecting');
      return false;
    }

    try {
      const success = await acsService.toggleMicrophone();
      if (success) {
        const newMuteState = acsService.isMicrophoneMuted();
        setIsMuted(newMuteState);
        console.log(`🎤 Microphone ${newMuteState ? 'muted' : 'unmuted'}`);
        // Clear any previous errors
        setError(null);
      }
      return success;
    } catch (error) {
      console.error('❌ Failed to toggle mute:', error);
      setError('Failed to toggle microphone');
      return false;
    }
  }, []);

  return {
    agent,
    currentCall,
    isConnected,
    isLoading,
    error,
    isMuted,
    login,
    logout,
    updateStatus,
    answerCall,
    endCall,
    toggleMute,
  };
};