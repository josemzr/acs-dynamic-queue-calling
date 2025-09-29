import { 
  CallClient, 
  CallAgent, 
  Call as ACSCall,
  IncomingCall,
  DeviceManager,
  AudioDeviceInfo,
  LocalVideoStream,
  RemoteParticipant,
  CallEndReason
} from '@azure/communication-calling';
import { 
  AzureCommunicationTokenCredential
} from '@azure/communication-common';

export interface ACSCallingConfig {
  userId: string;
  displayName: string;
  token: string;
}

export interface CallInfo {
  id: string;
  callId: string;
  participants: readonly RemoteParticipant[];
  state: string;
}

export class ACSCallingService {
  private callClient: CallClient | null = null;
  private callAgent: CallAgent | null = null;
  private deviceManager: DeviceManager | null = null;
  private currentCall: ACSCall | null = null;
  private localVideoStream: LocalVideoStream | null = null;
  private audioStream: MediaStream | null = null;

  private onCallStateChangedCallback?: (callInfo: CallInfo) => void;
  private onIncomingCallCallback?: (call: IncomingCall) => void;
  private onCallEndedCallback?: (reason: CallEndReason) => void;

  constructor() {
    console.log('🎤 ACSCallingService: Initializing...');
  }

  /**
   * Initialize the ACS Calling Client with user credentials
   */
  async initialize(config: ACSCallingConfig): Promise<boolean> {
    try {
      console.log(`🎤 ACSCallingService: Initializing for user ${config.displayName} (${config.userId})`);
      console.log(`🎤 ACSCallingService: Token length: ${config.token.length} characters`);
      
      // Create CallClient
      console.log('🎤 ACSCallingService: Creating CallClient...');
      this.callClient = new CallClient();
      
      // Create credential with access token
      console.log('🎤 ACSCallingService: Creating token credential...');
      const tokenCredential = new AzureCommunicationTokenCredential(config.token);
      
      // Create CallAgent
      console.log('🎤 ACSCallingService: Creating CallAgent...');
      this.callAgent = await this.callClient.createCallAgent(tokenCredential, {
        displayName: config.displayName
      });

      console.log('🎤 ACSCallingService: CallAgent created successfully');

      // Get device manager
      console.log('🎤 ACSCallingService: Getting device manager...');
      this.deviceManager = await this.callClient.getDeviceManager();
      
      // Request permissions for microphone and camera
      console.log('🎤 ACSCallingService: Requesting device permissions...');
      const permissionResponse = await this.deviceManager.askDevicePermission({ audio: true, video: false });
      console.log('🎤 ACSCallingService: Permission response:', permissionResponse);
      
      if (!permissionResponse.audio) {
        console.warn('⚠️ ACSCallingService: Microphone permission not granted');
        throw new Error('Microphone permission is required for voice calls');
      }
      
      console.log('🎤 ACSCallingService: Device permissions granted');

      // Get and maintain audio stream to prevent browser from releasing permissions
      try {
        console.log('🎤 ACSCallingService: Getting persistent audio stream...');
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('🎤 ACSCallingService: Persistent audio stream acquired');
        
        const microphones = await this.deviceManager.getMicrophones();
        console.log('🎤 ACSCallingService: Available microphones:', microphones.length);
        if (microphones.length > 0) {
          await this.deviceManager.selectMicrophone(microphones[0]);
          console.log('🎤 ACSCallingService: Selected default microphone:', microphones[0].name);
        }
      } catch (micError) {
        console.warn('⚠️ ACSCallingService: Could not set up audio stream:', micError);
      }

      // Set up event listeners
      console.log('🎤 ACSCallingService: Setting up event listeners...');
      this.setupEventListeners();

      console.log('✅ ACSCallingService: Initialization complete');
      return true;

    } catch (error) {
      console.error('❌ ACSCallingService: Initialization failed:', error);
      if (error instanceof Error) {
        console.error('❌ ACSCallingService: Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return false;
    }
  }

  /**
   * Set up event listeners for call events
   */
  private setupEventListeners(): void {
    if (!this.callAgent) return;

    // Listen for incoming calls
    this.callAgent.on('incomingCall', (args) => {
      console.log('📞 ACSCallingService: Incoming call received', args.incomingCall.id);
      if (this.onIncomingCallCallback) {
        this.onIncomingCallCallback(args.incomingCall);
      }
    });

    // Listen for call agent state changes
    this.callAgent.on('callsUpdated', (args) => {
      console.log('🔄 ACSCallingService: Calls updated', args);
      
      // Handle new calls
      args.added.forEach(call => {
        this.setupCallEventListeners(call);
      });
      
      // Handle removed calls
      args.removed.forEach(call => {
        console.log('📵 ACSCallingService: Call removed', call.id);
        if (this.currentCall && this.currentCall.id === call.id) {
          this.currentCall = null;
        }
      });
    });
  }

  /**
   * Set up event listeners for a specific call
   */
  private setupCallEventListeners(call: ACSCall): void {
    console.log(`🎯 ACSCallingService: Setting up event listeners for call ${call.id}`);
    
    // Listen for call state changes
    call.on('stateChanged', () => {
      console.log(`🔄 ACSCallingService: Call ${call.id} state changed to: ${call.state}`);
      
      // Special logging for key states
      if (call.state === 'Connected') {
        console.log('✅ ACSCallingService: Call is now CONNECTED - audio should be available');
        console.log(`🎤 ACSCallingService: Call mute state: ${call.isMuted ? 'muted' : 'unmuted'}`);
      } else if (call.state === 'Connecting') {
        console.log('🔄 ACSCallingService: Call is CONNECTING - audio controls may be limited');
      }
      
      const callInfo: CallInfo = {
        id: call.id,
        callId: call.id,
        participants: call.remoteParticipants,
        state: call.state
      };
      
      if (this.onCallStateChangedCallback) {
        this.onCallStateChangedCallback(callInfo);
      }

      // Handle call end
      if (call.state === 'Disconnected') {
        console.log('📵 ACSCallingService: Call ended', call.callEndReason);
        if (this.onCallEndedCallback && call.callEndReason) {
          this.onCallEndedCallback(call.callEndReason);
        }
        // Clear the current call reference
        if (this.currentCall && this.currentCall.id === call.id) {
          this.currentCall = null;
          console.log('🧹 ACSCallingService: Cleared current call reference');
        }
      }
    });

    // Listen for participants changes
    call.on('remoteParticipantsUpdated', (args) => {
      console.log('👥 ACSCallingService: Remote participants updated', args);
      
      // Handle new participants
      args.added.forEach(participant => {
        console.log('👤 ACSCallingService: Participant added:', participant.identifier);
        
        // Listen for participant state changes
        participant.on('stateChanged', () => {
          console.log(`👤 ACSCallingService: Participant ${participant.identifier} state: ${participant.state}`);
        });

        // Listen for video streams (audio streams are handled automatically)
        participant.on('videoStreamsUpdated', (args: any) => {
          console.log('� ACSCallingService: Video streams updated for participant');
          // Audio streams are automatically handled by the browser
        });
      });
    });
  }

  /**
   * Join an existing call using call ID or context
   */
  async joinCall(callId: string): Promise<boolean> {
    try {
      if (!this.callAgent) {
        console.error('❌ ACSCallingService: CallAgent not initialized');
        return false;
      }

      console.log(`📞 ACSCallingService: Attempting to join call: ${callId}`);

      // Join the call using group calling
      this.currentCall = this.callAgent.join({
        groupId: callId
      }, {
        audioOptions: {
          muted: false
        }
      });

      this.setupCallEventListeners(this.currentCall);
      
      console.log('✅ ACSCallingService: Successfully joined call');
      return true;

    } catch (error) {
      console.error('❌ ACSCallingService: Failed to join call:', error);
      return false;
    }
  }

  /**
   * Call a phone number directly
   */
  async callPhoneNumber(phoneNumber: string): Promise<boolean> {
    try {
      if (!this.callAgent) {
        console.error('❌ ACSCallingService: CallAgent not initialized');
        return false;
      }

      console.log(`📞 ACSCallingService: Calling phone number: ${phoneNumber}`);

      // Format phone number for ACS
      const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      
      // Start a call to the phone number
      this.currentCall = this.callAgent.startCall([
        { phoneNumber: formattedNumber }
      ], {
        audioOptions: {
          muted: false
        }
      });

      this.setupCallEventListeners(this.currentCall);
      
      console.log('✅ ACSCallingService: Phone call initiated successfully');
      return true;

    } catch (error) {
      console.error('❌ ACSCallingService: Failed to call phone number:', error);
      return false;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(incomingCall?: IncomingCall): Promise<boolean> {
    try {
      if (!incomingCall) {
        console.error('❌ ACSCallingService: No incoming call to answer');
        return false;
      }

      console.log(`📞 ACSCallingService: Answering incoming call: ${incomingCall.id}`);
      console.log(`🔍 ACSCallingService: Incoming call info:`, {
        id: incomingCall.id,
        callerInfo: incomingCall.callerInfo
      });

      // Answer the incoming call with audio options
      console.log('⏳ ACSCallingService: Accepting incoming call with audio enabled...');
      this.currentCall = await incomingCall.accept({
        audioOptions: {
          muted: false
        }
      });

      console.log(`✅ ACSCallingService: Call accepted - ID: ${this.currentCall.id}, Initial state: ${this.currentCall.state}`);
      
      // Set up event listeners for the accepted call
      this.setupCallEventListeners(this.currentCall);
      
      // Log initial call details
      console.log('🎤 ACSCallingService: Call details after accept:', {
        id: this.currentCall.id,
        state: this.currentCall.state,
        direction: this.currentCall.direction,
        isMuted: this.currentCall.isMuted,
        participantCount: this.currentCall.remoteParticipants.length
      });
      
      console.log('✅ ACSCallingService: Incoming call answered successfully');
      return true;

    } catch (error) {
      console.error('❌ ACSCallingService: Failed to answer incoming call:', error);
      if (error instanceof Error) {
        console.error('❌ ACSCallingService: Accept error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return false;
    }
  }

  /**
   * End the current call
   */
  async endCall(): Promise<boolean> {
    try {
      if (!this.currentCall) {
        console.error('❌ ACSCallingService: No active call to end');
        return false;
      }

      console.log(`📵 ACSCallingService: Ending call: ${this.currentCall.id}`);

      await this.currentCall.hangUp();
      this.currentCall = null;
      
      console.log('✅ ACSCallingService: Call ended successfully');
      return true;

    } catch (error) {
      console.error('❌ ACSCallingService: Failed to end call:', error);
      return false;
    }
  }

  /**
   * Mute/unmute microphone
   */
  async toggleMicrophone(): Promise<boolean> {
    try {
      console.log('🎤 ACSCallingService: toggleMicrophone called');
      console.log('🔍 ACSCallingService: Call debug info:', this.getCallDebugInfo());
      
      if (!this.currentCall) {
        console.error('❌ ACSCallingService: No active call for microphone toggle');
        return false;
      }

      // Allow mute controls for both Connected and Connecting states
      if (this.currentCall.state !== 'Connected' && this.currentCall.state !== 'Connecting') {
        console.error(`❌ ACSCallingService: Call not in usable state (state: ${this.currentCall.state})`);
        return false;
      }

      // For Connecting state, wait a short time for the call to fully establish
      if (this.currentCall.state === 'Connecting') {
        console.log('⏳ ACSCallingService: Call still connecting, waiting briefly...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (this.currentCall.state === 'Connecting') {
          console.log('⚠️ ACSCallingService: Call still connecting, but attempting mute operation...');
        }
      }

      const isMuted = this.currentCall.isMuted;
      console.log(`🎤 ACSCallingService: Current mute state: ${isMuted ? 'muted' : 'unmuted'}`);
      
      if (isMuted) {
        await this.currentCall.unmute();
        console.log('🎤 ACSCallingService: Microphone unmuted');
      } else {
        await this.currentCall.mute();
        console.log('🔇 ACSCallingService: Microphone muted');
      }
      
      return true;

    } catch (error) {
      console.error('❌ ACSCallingService: Failed to toggle microphone:', error);
      if (error instanceof Error) {
        console.error('❌ ACSCallingService: Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      return false;
    }
  }

  /**
   * Get current microphone state
   */
  isMicrophoneMuted(): boolean {
    return this.currentCall?.isMuted ?? false;
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices(): Promise<AudioDeviceInfo[]> {
    if (!this.deviceManager) {
      console.error('❌ ACSCallingService: Device manager not initialized');
      return [];
    }

    return this.deviceManager.getMicrophones();
  }

  /**
   * Get available speakers
   */
  async getSpeakers(): Promise<AudioDeviceInfo[]> {
    if (!this.deviceManager) {
      console.error('❌ ACSCallingService: Device manager not initialized');
      return [];
    }

    return this.deviceManager.getSpeakers();
  }

  /**
   * Set audio device
   */
  async selectAudioDevice(device: AudioDeviceInfo): Promise<void> {
    if (!this.deviceManager) {
      console.error('❌ ACSCallingService: Device manager not initialized');
      return;
    }

    await this.deviceManager.selectMicrophone(device);
    console.log(`🎤 ACSCallingService: Selected microphone: ${device.name}`);
  }

  /**
   * Set speaker device
   */
  async selectSpeaker(device: AudioDeviceInfo): Promise<void> {
    if (!this.deviceManager) {
      console.error('❌ ACSCallingService: Device manager not initialized');
      return;
    }

    await this.deviceManager.selectSpeaker(device);
    console.log(`🔊 ACSCallingService: Selected speaker: ${device.name}`);
  }

  /**
   * Get current call state
   */
  getCurrentCallState(): string | null {
    const state = this.currentCall?.state ?? null;
    console.log(`🔍 ACSCallingService: getCurrentCallState - ${state}`);
    return state;
  }

  /**
   * Get detailed call information for debugging
   */
  getCallDebugInfo(): any {
    if (!this.currentCall) {
      return { status: 'No active call', currentCall: null };
    }

    return {
      status: 'Call exists',
      callId: this.currentCall.id,
      state: this.currentCall.state,
      direction: this.currentCall.direction,
      participants: this.currentCall.remoteParticipants.length,
      isMuted: this.currentCall.isMuted
    };
  }

  /**
   * Check if there's an active call
   */
  hasActiveCall(): boolean {
    const hasCall = this.currentCall !== null && 
      (this.currentCall.state === 'Connected' || this.currentCall.state === 'Connecting');
    console.log(`🔍 ACSCallingService: hasActiveCall check - currentCall: ${this.currentCall ? this.currentCall.state : 'null'}, result: ${hasCall}`);
    return hasCall;
  }

  /**
   * Set callback for call state changes
   */
  onCallStateChanged(callback: (callInfo: CallInfo) => void): void {
    this.onCallStateChangedCallback = callback;
  }

  /**
   * Set callback for incoming calls
   */
  onIncomingCall(callback: (call: IncomingCall) => void): void {
    this.onIncomingCallCallback = callback;
  }

  /**
   * Set callback for call ended
   */
  onCallEnded(callback: (reason: CallEndReason) => void): void {
    this.onCallEndedCallback = callback;
  }

  /**
   * Dispose of the calling service
   */
  async dispose(): Promise<void> {
    try {
      if (this.currentCall) {
        await this.currentCall.hangUp();
      }
      
      if (this.callAgent) {
        this.callAgent.dispose();
      }
      
      // Clean up audio stream
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }
      
      this.currentCall = null;
      this.callAgent = null;
      this.callClient = null;
      this.deviceManager = null;
      
      console.log('🧹 ACSCallingService: Disposed successfully');

    } catch (error) {
      console.error('❌ ACSCallingService: Error during disposal:', error);
    }
  }
}