import { Request, Response } from 'express';
import { GroupService } from '../services/groupService';
import { WebSocketService } from '../services/webSocketService';
import { ApiResponse, CreateGroupRequest, UpdateGroupRequest } from '../models/types';

export class GroupController {
  private groupService: GroupService;
  private webSocketService: WebSocketService;

  constructor(groupService: GroupService, webSocketService: WebSocketService) {
    this.groupService = groupService;
    this.webSocketService = webSocketService;
  }

  createGroup = (req: Request, res: Response): void => {
    try {
      const createRequest: CreateGroupRequest = req.body;
      
      if (!createRequest.name || !createRequest.location || !createRequest.phoneNumber) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Missing required fields: name, location, phoneNumber'
        };
        res.status(400).json(response);
        return;
      }

      const group = this.groupService.createGroup(createRequest);
      
      // Notify supervisors
      this.webSocketService.notifySupervisors('group_created', group);

      const response: ApiResponse<typeof group> = {
        success: true,
        data: group,
        message: 'Group created successfully'
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

  getGroup = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const group = this.groupService.getGroup(id);

      if (!group) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Group not found'
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<typeof group> = {
        success: true,
        data: group
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

  getAllGroups = (req: Request, res: Response): void => {
    try {
      const groups = this.groupService.getAllGroups();
      
      const response: ApiResponse<typeof groups> = {
        success: true,
        data: groups
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

  updateGroup = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const updates: UpdateGroupRequest = req.body;

      const group = this.groupService.updateGroup(id, updates);

      if (!group) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Group not found'
        };
        res.status(404).json(response);
        return;
      }

      // Notify supervisors
      this.webSocketService.notifySupervisors('group_updated', group);

      const response: ApiResponse<typeof group> = {
        success: true,
        data: group,
        message: 'Group updated successfully'
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

  deleteGroup = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const deleted = this.groupService.deleteGroup(id);

      if (!deleted) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Group not found'
        };
        res.status(404).json(response);
        return;
      }

      // Notify supervisors
      this.webSocketService.notifySupervisors('group_deleted', { groupId: id });

      const response: ApiResponse<null> = {
        success: true,
        message: 'Group deleted successfully'
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

  addAgentToGroup = (req: Request, res: Response): void => {
    try {
      const { groupId, agentId } = req.params;
      const success = this.groupService.addAgentToGroup(groupId, agentId);

      if (!success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Failed to add agent to group. Group or agent not found.'
        };
        res.status(404).json(response);
        return;
      }

      const group = this.groupService.getGroup(groupId);
      
      // Notify supervisors
      this.webSocketService.notifySupervisors('agent_added_to_group', { groupId, agentId, group });

      const response: ApiResponse<typeof group> = {
        success: true,
        data: group,
        message: 'Agent added to group successfully'
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

  removeAgentFromGroup = (req: Request, res: Response): void => {
    try {
      const { groupId, agentId } = req.params;
      const success = this.groupService.removeAgentFromGroup(groupId, agentId);

      if (!success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Failed to remove agent from group. Group or agent not found.'
        };
        res.status(404).json(response);
        return;
      }

      const group = this.groupService.getGroup(groupId);
      
      // Notify supervisors
      this.webSocketService.notifySupervisors('agent_removed_from_group', { groupId, agentId, group });

      const response: ApiResponse<typeof group> = {
        success: true,
        data: group,
        message: 'Agent removed from group successfully'
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

  setOverflowGroups = (req: Request, res: Response): void => {
    try {
      const { groupId } = req.params;
      const { overflowGroupIds } = req.body;

      if (!Array.isArray(overflowGroupIds)) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'overflowGroupIds must be an array'
        };
        res.status(400).json(response);
        return;
      }

      const success = this.groupService.setOverflowGroups(groupId, overflowGroupIds);

      if (!success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Group not found'
        };
        res.status(404).json(response);
        return;
      }

      const group = this.groupService.getGroup(groupId);
      
      // Notify supervisors
      this.webSocketService.notifySupervisors('overflow_groups_updated', { groupId, group });

      const response: ApiResponse<typeof group> = {
        success: true,
        data: group,
        message: 'Overflow groups updated successfully'
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

  enableOverflow = (req: Request, res: Response): void => {
    try {
      const { groupId } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        const response: ApiResponse<null> = {
          success: false,
          error: 'enabled must be a boolean'
        };
        res.status(400).json(response);
        return;
      }

      const success = this.groupService.enableOverflow(groupId, enabled);

      if (!success) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Group not found'
        };
        res.status(404).json(response);
        return;
      }

      const group = this.groupService.getGroup(groupId);
      
      // Notify supervisors
      this.webSocketService.notifySupervisors('overflow_status_updated', { groupId, enabled, group });

      const response: ApiResponse<typeof group> = {
        success: true,
        data: group,
        message: `Overflow ${enabled ? 'enabled' : 'disabled'} successfully`
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