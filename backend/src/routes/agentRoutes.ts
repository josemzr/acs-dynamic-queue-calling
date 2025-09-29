import { Router } from 'express';
import { AgentController } from '../controllers/agentController';

export function createAgentRoutes(agentController: AgentController): Router {
  const router = Router();

  // Agent authentication
  router.post('/login', agentController.login);

  // Agent CRUD operations
  router.post('/', agentController.createAgent);
  router.get('/', agentController.getAllAgents);
  router.get('/:id', agentController.getAgent);
  router.put('/:id', agentController.updateAgent);
  router.delete('/:id', agentController.deleteAgent);

  // Agent status management
  router.patch('/:id/status', agentController.updateAgentStatus);
  router.patch('/:id/acs-user', agentController.updateAgentACSUserId);

  // Group-specific agent queries
  router.get('/group/:groupId', agentController.getAgentsByGroup);

  return router;
}