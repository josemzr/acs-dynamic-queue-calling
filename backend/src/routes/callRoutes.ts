import { Router } from 'express';
import { CallController } from '../controllers/callController';
import { acsWebhookLogger } from '../middleware/webhookLogger';

export function createCallRoutes(callController: CallController): Router {
  const router = Router();

  // Call handling - incoming calls from ACS with enhanced logging
  router.post('/incoming', acsWebhookLogger, callController.handleIncomingCall);
  router.post('/events', acsWebhookLogger, callController.handleACSCallEvents);
  router.post('/:callId/answer', callController.answerCall);
  router.post('/:callId/end', callController.endCall);
  router.post('/:callId/transfer', callController.transferCall);

  // Call queries
  router.get('/active', callController.getActiveCalls);
  router.get('/:callId', callController.getCall);
  router.get('/agent/:agentId', callController.getCallsByAgent);
  router.get('/group/:groupId', callController.getCallsByGroup);
  
  // ACS integration endpoints
  router.get('/acs-token/:agentId', callController.getACSToken);
  router.get('/test-acs', callController.testACSConnection);

  return router;
}