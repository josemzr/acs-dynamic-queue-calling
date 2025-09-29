import { Request, Response } from 'express';
import { CallController } from '../controllers/callController';
import { CallService } from '../services/callService';
import { WebSocketService } from '../services/webSocketService';

// Mock the services
jest.mock('../services/callService', () => {
  return {
    CallService: jest.fn().mockImplementation(() => ({
      handleIncomingCall: jest.fn(),
    }))
  };
});

jest.mock('../services/webSocketService', () => {
  return {
    WebSocketService: jest.fn().mockImplementation(() => ({}))
  };
});

describe('CallController', () => {
  let callController: CallController;
  let mockCallService: jest.Mocked<CallService>;
  let mockWebSocketService: jest.Mocked<WebSocketService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockCallService = new CallService({} as any, {} as any, {} as any) as jest.Mocked<CallService>;
    mockWebSocketService = new WebSocketService(3002) as jest.Mocked<WebSocketService>;
    callController = new CallController(mockCallService, mockWebSocketService);

    mockRequest = {
      body: {},
      webhookRequestId: 'test-request-id'
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock console.log to prevent test output pollution
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleIncomingCall', () => {
    it('should handle EventGrid subscription validation', async () => {
      const validationCode = 'test-validation-code';
      mockRequest.body = [
        {
          eventType: 'Microsoft.EventGrid.SubscriptionValidationEvent',
          data: {
            validationCode
          }
        }
      ];

      await callController.handleIncomingCall(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        validationResponse: validationCode
      });
    });

    it('should return 400 for validation event without validation code', async () => {
      mockRequest.body = [
        {
          eventType: 'Microsoft.EventGrid.SubscriptionValidationEvent',
          data: {}
        }
      ];

      await callController.handleIncomingCall(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing validation code'
      });
    });

    it('should handle ACS incoming call events', async () => {
      const mockCall = {
        id: 'test-call-id',
        phoneNumber: '+18666460611',
        groupId: 'test-group',
        status: 'incoming'
      };

      mockRequest.body = [
        {
          eventType: 'Microsoft.Communication.IncomingCall',
          data: {
            to: {
              phoneNumber: {
                value: '+18666460611'
              }
            },
            from: {
              phoneNumber: {
                value: '+34669714520'
              }
            }
          }
        }
      ];

      mockCallService.handleIncomingCall.mockResolvedValue(mockCall as any);

      await callController.handleIncomingCall(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCallService.handleIncomingCall).toHaveBeenCalledWith(
        '+18666460611',
        '+34669714520',
        mockRequest.body[0].data
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCall,
        message: 'Call handled successfully'
      });
    });

    it('should return 400 for ACS call events missing phone number data', async () => {
      mockRequest.body = [
        {
          eventType: 'Microsoft.Communication.IncomingCall',
          data: {
            to: {},
            from: {}
          }
        }
      ];

      await callController.handleIncomingCall(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required phone number fields in ACS event'
      });
    });

    it('should return 400 for ACS call events missing call data', async () => {
      mockRequest.body = [
        {
          eventType: 'Microsoft.Communication.IncomingCall'
          // missing data field
        }
      ];

      await callController.handleIncomingCall(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing call data in incoming call event'
      });
    });

    it('should handle legacy call events with phoneNumber and callerNumber (backward compatibility)', async () => {
      const mockCall = {
        id: 'test-call-id',
        phoneNumber: '+1234567890',
        groupId: 'test-group',
        status: 'incoming'
      };

      mockRequest.body = {
        phoneNumber: '+1234567890',
        callerNumber: '+0987654321'
      };

      mockCallService.handleIncomingCall.mockResolvedValue(mockCall as any);

      await callController.handleIncomingCall(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockCallService.handleIncomingCall).toHaveBeenCalledWith(
        '+1234567890',
        '+0987654321'
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCall,
        message: 'Call handled successfully'
      });
    });

    it('should return 400 for regular call events missing required fields', async () => {
      mockRequest.body = {
        phoneNumber: '+1234567890'
        // missing callerNumber
      };

      await callController.handleIncomingCall(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields: phoneNumber, callerNumber'
      });
    });
  });
});