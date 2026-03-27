let services = [
  {
    serviceID: 1,
    serviceName: 'General Support',
    description: 'General in-person support for queue and ticket help.',
    expectedDuration: 10,
    priorityLevel: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    serviceID: 2,
    serviceName: 'Ticket Issue',
    description: 'Resolve ticket purchase, confirmation, and seat assignment issues.',
    expectedDuration: 15,
    priorityLevel: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let nextServiceID = services.length + 1;

const PRIORITY_LEVELS = new Set(['low', 'medium', 'high']);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', () => reject(new Error('Failed to read request body')));
  });
}

function validateCreatePayload(payload) {
  const errors = [];

  if (typeof payload.serviceName !== 'string' || !payload.serviceName.trim()) {
    errors.push('serviceName is required and must be a string');
  } else if (payload.serviceName.trim().length < 2 || payload.serviceName.trim().length > 100) {
    errors.push('serviceName length must be between 2 and 100 characters');
  }

  if (typeof payload.description !== 'string' || !payload.description.trim()) {
    errors.push('description is required and must be a string');
  } else if (payload.description.trim().length < 5 || payload.description.trim().length > 500) {
    errors.push('description length must be between 5 and 500 characters');
  }

  if (!Number.isInteger(payload.expectedDuration)) {
    errors.push('expectedDuration is required and must be an integer');
  } else if (payload.expectedDuration < 1 || payload.expectedDuration > 480) {
    errors.push('expectedDuration must be between 1 and 480 minutes');
  }

  if (typeof payload.priorityLevel !== 'string') {
    errors.push('priorityLevel is required and must be a string');
  } else if (!PRIORITY_LEVELS.has(payload.priorityLevel.toLowerCase())) {
    errors.push('priorityLevel must be one of: low, medium, high');
  }

  return errors;
}

function validateUpdatePayload(payload) {
  const errors = [];
  const allowedFields = ['serviceName', 'description', 'expectedDuration', 'priorityLevel'];
  const payloadFields = Object.keys(payload);

  if (payloadFields.length === 0) {
    errors.push('At least one updatable field is required');
    return errors;
  }

  const invalidFields = payloadFields.filter((field) => !allowedFields.includes(field));
  if (invalidFields.length > 0) {
    errors.push(`Invalid field(s): ${invalidFields.join(', ')}`);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'serviceName')) {
    if (typeof payload.serviceName !== 'string' || !payload.serviceName.trim()) {
      errors.push('serviceName must be a non-empty string');
    } else if (payload.serviceName.trim().length < 2 || payload.serviceName.trim().length > 100) {
      errors.push('serviceName length must be between 2 and 100 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    if (typeof payload.description !== 'string' || !payload.description.trim()) {
      errors.push('description must be a non-empty string');
    } else if (payload.description.trim().length < 5 || payload.description.trim().length > 500) {
      errors.push('description length must be between 5 and 500 characters');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'expectedDuration')) {
    if (!Number.isInteger(payload.expectedDuration)) {
      errors.push('expectedDuration must be an integer');
    } else if (payload.expectedDuration < 1 || payload.expectedDuration > 480) {
      errors.push('expectedDuration must be between 1 and 480 minutes');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'priorityLevel')) {
    if (typeof payload.priorityLevel !== 'string' || !PRIORITY_LEVELS.has(payload.priorityLevel.toLowerCase())) {
      errors.push('priorityLevel must be one of: low, medium, high');
    }
  }

  return errors;
}

function listServices(req, res) {
  sendJson(res, 200, {
    success: true,
    count: services.length,
    services,
  });
}

async function createService(req, res) {
  try {
    const payload = await readJsonBody(req);
    const errors = validateCreatePayload(payload);
    if (errors.length > 0) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    const now = new Date().toISOString();
    const service = {
      serviceID: nextServiceID++,
      serviceName: payload.serviceName.trim(),
      description: payload.description.trim(),
      expectedDuration: payload.expectedDuration,
      priorityLevel: payload.priorityLevel.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    services.push(service);

    sendJson(res, 201, {
      success: true,
      message: 'Service created successfully',
      service,
    });
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message || 'Unable to create service' });
  }
}

async function updateService(req, res, serviceID) {
  const parsedServiceID = Number(serviceID);
  if (!Number.isInteger(parsedServiceID) || parsedServiceID <= 0) {
    sendJson(res, 400, { success: false, message: 'serviceId must be a positive integer' });
    return;
  }

  const serviceIndex = services.findIndex((item) => item.serviceID === parsedServiceID);
  if (serviceIndex === -1) {
    sendJson(res, 404, { success: false, message: 'Service not found' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const errors = validateUpdatePayload(payload);
    if (errors.length > 0) {
      sendJson(res, 400, { success: false, errors });
      return;
    }

    const current = services[serviceIndex];
    const updatedService = {
      ...current,
      ...(Object.prototype.hasOwnProperty.call(payload, 'serviceName') ? { serviceName: payload.serviceName.trim() } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'description') ? { description: payload.description.trim() } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'expectedDuration') ? { expectedDuration: payload.expectedDuration } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'priorityLevel') ? { priorityLevel: payload.priorityLevel.toLowerCase() } : {}),
      updatedAt: new Date().toISOString(),
    };

    services[serviceIndex] = updatedService;

    sendJson(res, 200, {
      success: true,
      message: 'Service updated successfully',
      service: updatedService,
    });
  } catch (error) {
    sendJson(res, 400, { success: false, message: error.message || 'Unable to update service' });
  }
}

module.exports = {
  listServices,
  createService,
  updateService,
};
