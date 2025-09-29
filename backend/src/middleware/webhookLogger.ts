import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Interface for webhook log entry
interface WebhookLogEntry {
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, any>;
  body: any;
  ip: string;
  userAgent?: string;
}

// Interface for webhook response log entry
interface WebhookResponseLogEntry {
  requestId: string;
  timestamp: string;
  statusCode: number;
  responseBody: any;
  duration: number;
}

/**
 * Middleware to log detailed webhook requests and responses for ACS debugging
 */
export const webhookLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Add request ID to the request object for correlation
  (req as any).webhookRequestId = requestId;

  const logEntry: WebhookLogEntry = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent')
  };

  // Log the incoming webhook request
  console.log('🔄 WEBHOOK REQUEST:', JSON.stringify(logEntry, null, 2));

  // Capture the original res.json method
  const originalJson = res.json.bind(res);

  // Override res.json to log the response
  res.json = function(body: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    const responseLogEntry: WebhookResponseLogEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      statusCode: res.statusCode,
      responseBody: body,
      duration
    };

    // Log the webhook response
    console.log('📤 WEBHOOK RESPONSE:', JSON.stringify(responseLogEntry, null, 2));

    // Call the original res.json method
    return originalJson(body);
  };

  next();
};

/**
 * Enhanced logger specifically for ACS webhook endpoints
 * Includes validation URL logging and special ACS headers
 */
export const acsWebhookLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Add request ID to the request object for correlation
  (req as any).webhookRequestId = requestId;

  // Extract ACS-specific information
  const acsInfo = {
    validationUrl: req.headers['webhook-validation-url'] || req.body?.validationUrl,
    validationCode: req.headers['webhook-validation-code'] || req.body?.validationCode,
    eventType: req.headers['ce-type'] || req.body?.eventType,
    eventSource: req.headers['ce-source'] || req.body?.source,
    eventId: req.headers['ce-id'] || req.body?.id,
    contentType: req.headers['content-type']
  };

  const logEntry = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent'),
    acsInfo,
    headers: req.headers,
    body: req.body
  };

  // Special logging for ACS webhook requests
  console.log('🎯 ACS WEBHOOK REQUEST:', JSON.stringify(logEntry, null, 2));
  
  // If there's a validation URL, log it prominently
  if (acsInfo.validationUrl) {
    console.log(`🔗 ACS Validation URL: ${acsInfo.validationUrl}`);
  }

  // Capture the original res.json method
  const originalJson = res.json.bind(res);

  // Override res.json to log the response
  res.json = function(body: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    const responseLogEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      statusCode: res.statusCode,
      responseBody: body,
      duration,
      success: res.statusCode >= 200 && res.statusCode < 300
    };

    // Log the ACS webhook response
    console.log('📤 ACS WEBHOOK RESPONSE:', JSON.stringify(responseLogEntry, null, 2));

    return originalJson(body);
  };

  next();
};