import React from 'react';
import { useAgentState } from './hooks/useAgentState';
import { LoginForm } from './components/LoginForm';
import { AgentDashboard } from './components/AgentDashboard';
import { CallInterface } from './components/CallInterface';
import './App.css';

function App() {
  const {
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
  } = useAgentState();

  if (!agent) {
    return (
      <div className="App">
        <LoginForm
          onLogin={login}
          isLoading={isLoading}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <div className="app-layout">
        <div className="dashboard-section">
          <AgentDashboard
            agent={agent}
            isConnected={isConnected}
            onStatusChange={updateStatus}
            onLogout={logout}
          />
        </div>
        
        <div className="call-section">
          <CallInterface
            call={currentCall}
            isMuted={isMuted}
            onAnswerCall={answerCall}
            onEndCall={endCall}
            onToggleMute={toggleMute}
          />
        </div>
      </div>
      
      {error && (
        <div className="error-toast">
          <span>❌ {error}</span>
        </div>
      )}
    </div>
  );
}

export default App;
