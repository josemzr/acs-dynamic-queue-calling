import React, { useState, useEffect } from 'react';
import { Call, CallStatus } from '../types';
import './CallInterface.css';

interface CallInterfaceProps {
  call: Call | null;
  isMuted?: boolean;
  onAnswerCall: (callId: string) => Promise<boolean>;
  onEndCall: (callId: string) => Promise<boolean>;
  onToggleMute?: () => Promise<boolean>;
}

export const CallInterface: React.FC<CallInterfaceProps> = ({
  call,
  isMuted = false,
  onAnswerCall,
  onEndCall,
  onToggleMute,
}) => {
  const [isAnswering, setIsAnswering] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (call && call.status === CallStatus.CONNECTED) {
      interval = setInterval(() => {
        const duration = Math.floor((Date.now() - new Date(call.startTime).getTime()) / 1000);
        setCallDuration(duration);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [call]);

  const handleAnswerCall = async () => {
    if (!call) return;
    
    setIsAnswering(true);
    try {
      await onAnswerCall(call.id);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleEndCall = async () => {
    if (!call) return;
    
    setIsEnding(true);
    try {
      await onEndCall(call.id);
    } finally {
      setIsEnding(false);
    }
  };

  const handleToggleMute = async () => {
    if (!onToggleMute) return;
    
    setIsMuting(true);
    try {
      await onToggleMute();
    } finally {
      setIsMuting(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phoneNumber: string): string => {
    // Simple phone number formatting
    if (phoneNumber.length === 10) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
    }
    return phoneNumber;
  };

  if (!call) {
    return (
      <div className="call-interface-container">
        <div className="no-call-state">
          <div className="no-call-icon">📞</div>
          <h3>Waiting for calls...</h3>
          <p>You will be notified when a call comes in</p>
        </div>
      </div>
    );
  }

  return (
    <div className="call-interface-container">
      <div className={`call-card ${call.status.toLowerCase()}`}>
        <div className="call-header">
          <div className="caller-info">
            <h2 className="caller-number">{formatPhoneNumber(call.phoneNumber)}</h2>
            <p className="call-status">
              {call.status === CallStatus.INCOMING && 'Incoming Call'}
              {call.status === CallStatus.RINGING && 'Ringing...'}
              {call.status === CallStatus.CONNECTED && 'Connected'}
            </p>
          </div>
          
          {call.status === CallStatus.CONNECTED && (
            <div className="call-timer">
              <span className="timer-icon">⏱️</span>
              <span className="timer-text">{formatDuration(callDuration)}</span>
            </div>
          )}
        </div>

        <div className="call-details">
          <div className="detail-item">
            <span className="detail-label">Call ID:</span>
            <span className="detail-value">{call.id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Start Time:</span>
            <span className="detail-value">
              {new Date(call.startTime).toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="call-actions">
          {(call.status === CallStatus.INCOMING || call.status === CallStatus.RINGING) && (
            <button
              className="answer-button"
              onClick={handleAnswerCall}
              disabled={isAnswering}
            >
              {isAnswering ? 'Answering...' : '📞 Answer'}
            </button>
          )}
          
          {call.status === CallStatus.CONNECTED && (
            <>
              {onToggleMute && (
                <button
                  className={`mute-button ${isMuted ? 'muted' : 'unmuted'}`}
                  onClick={handleToggleMute}
                  disabled={isMuting}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuting ? '⏳' : (isMuted ? '🔇' : '🎤')} {isMuted ? 'Muted' : 'Unmute'}
                </button>
              )}
              <button
                className="end-button"
                onClick={handleEndCall}
                disabled={isEnding}
              >
                {isEnding ? 'Ending...' : '📵 End Call'}
              </button>
            </>
          )}
        </div>
      </div>

      {call.status === CallStatus.INCOMING && (
        <div className="incoming-call-overlay">
          <div className="incoming-animation">
            <div className="pulse-ring"></div>
            <div className="pulse-ring delay-1"></div>
            <div className="pulse-ring delay-2"></div>
          </div>
        </div>
      )}
    </div>
  );
};