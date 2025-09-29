import { Router } from 'express';
import { GroupController } from '../controllers/groupController';

export function createGroupRoutes(groupController: GroupController): Router {
  const router = Router();

  // Group CRUD operations
  router.post('/', groupController.createGroup);
  router.get('/', groupController.getAllGroups);
  router.get('/:id', groupController.getGroup);
  router.put('/:id', groupController.updateGroup);
  router.delete('/:id', groupController.deleteGroup);

  // Agent management within groups
  router.post('/:groupId/agents/:agentId', groupController.addAgentToGroup);
  router.delete('/:groupId/agents/:agentId', groupController.removeAgentFromGroup);

  // Overflow management
  router.put('/:groupId/overflow', groupController.setOverflowGroups);
  router.patch('/:groupId/overflow/enable', groupController.enableOverflow);

  return router;
}