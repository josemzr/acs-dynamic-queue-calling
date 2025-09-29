import { Request, Response } from 'express';
import { AgentService } from '../services/agentService';
import { WebSocketService } from '../services/webSocketService';
import { ApiResponse, CreateAgentRequest, UpdateAgentRequest, AgentStatus, AgentLoginRequest, AgentLoginResponse } from '../models/types';

export class AgentController {
  private agentService: AgentService;
  private webSocketService: WebSocketService;

  constructor(agentService: AgentService, webSocketService: WebSocketService) {
    this.agentService = agentService;
    this.webSocketService = webSocketService;
  }

  createAgent = (req: Request, res: Response): void => {
    try {
      const createRequest: CreateAgentRequest = req.body;
      
      if (!createRequest.name || !createRequest.email || !createRequest.username || !createRequest.password || !createRequest.groupIds) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Missing required fields: name, email, username, password, groupIds'
        };
        res.status(400).json(response);
        return;
      }

      const agent = this.agentService.createAgent(createRequest);
      
      // Notify supervisors
      this.webSocketService.notifySupervisors('agent_created', agent);

      const response: ApiResponse<typeof agent> = {
        success: true,
        data: agent,
        message: 'Agent created successfully'
      };
      
      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  getAgent = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const agent = this.agentService.getAgent(id);

      if (!agent) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Agent not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof agent> = {
        success: true,
        data: agent
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

  getAllAgents = (req: Request, res: Response): void => {
    try {
      const agents = this.agentService.getAllAgents();
      
      const response: ApiResponse<typeof agents> = {
        success: true,
        data: agents
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

  getAgentsByGroup = (req: Request, res: Response): void => {
    try {
      const { groupId } = req.params;
      const agents = this.agentService.getAgentsByGroup(groupId);
      
      const response: ApiResponse<typeof agents> = {
        success: true,
        data: agents
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

  updateAgent = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const updates: UpdateAgentRequest = req.body;

      const agent = this.agentService.updateAgent(id, updates);

      if (!agent) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Agent not found'
        };
        res.status(404).json(response);
        return;
      }

      // Notify supervisors and the agent
      this.webSocketService.notifySupervisors('agent_updated', agent);
      this.webSocketService.notifyAgent(agent.id, 'status_updated', agent);

      const response: ApiResponse<typeof agent> = {
        success: true,
        data: agent,
        message: 'Agent updated successfully'
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

  updateAgentStatus = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!Object.values(AgentStatus).includes(status)) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid status'
        };
        res.status(400).json(response);
        return;
      }

      const agent = this.agentService.updateAgentStatus(id, status);

      if (!agent) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Agent not found'
        };
        res.status(404).json(response);
        return;
      }

      // Notify supervisors and the agent
      this.webSocketService.notifySupervisors('agent_status_updated', agent);
      this.webSocketService.notifyAgent(agent.id, 'status_updated', agent);

      const response: ApiResponse<typeof agent> = {
        success: true,
        data: agent,
        message: 'Agent status updated successfully'
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

  updateAgentACSUserId = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const { acsUserId } = req.body;

      if (!acsUserId) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'ACS User ID is required'
        };
        res.status(400).json(response);
        return;
      }

      const agent = this.agentService.updateAgentACSUserId(id, acsUserId);

      if (!agent) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Agent not found'
        };
        res.status(404).json(response);
        return;
      }

      console.log(`🔗 Agent ${agent.name} (${id}) linked to ACS User ID: ${acsUserId}`);

      const response: ApiResponse<typeof agent> = {
        success: true,
        data: agent,
        message: 'Agent ACS User ID updated successfully'
      };
      
      res.json(response);
    } catch (error) {
      console.error('❌ AgentController: Error updating agent ACS User ID:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: 'Internal server error'
      };
      res.status(500).json(response);
    }
  };

  deleteAgent = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const deleted = this.agentService.deleteAgent(id);

      if (!deleted) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Agent not found'
        };
        res.status(404).json(response);
        return;
      }

      // Disconnect agent if connected
      this.webSocketService.disconnectAgent(id);
      
      // Notify supervisors
      this.webSocketService.notifySupervisors('agent_deleted', { agentId: id });

      const response: ApiResponse<null> = {
        success: true,
        message: 'Agent deleted successfully'
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

  login = (req: Request, res: Response): void => {
    try {
      const loginRequest: AgentLoginRequest = req.body;
      
      if (!loginRequest.username || !loginRequest.password) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Missing required fields: username, password'
        };
        res.status(400).json(response);
        return;
      }

      const agent = this.agentService.authenticateAgent(loginRequest.username, loginRequest.password);
      
      if (!agent) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid username or password'
        };
        res.status(401).json(response);
        return;
      }

      const loginResponse: AgentLoginResponse = {
        agent: agent
      };

      const response: ApiResponse<AgentLoginResponse> = {
        success: true,
        data: loginResponse,
        message: 'Login successful'
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
}