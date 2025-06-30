import { Schema, model } from 'mongoose';

import { 
  API_KEY_CONFIG,
  RATE_LIMIT_DEFAULTS,
  DATA_RETENTION_PERIODS 
} from '../constants/widget';
import { IApiKey, RateLimitConfig } from '../types/widget';
import { encryptionService } from '../utils/encryption';

/**
 * Rate Limit Configuration sub-schema
 */
const rateLimitConfigSchema = new Schema<RateLimitConfig>({
  windowMs: {
    type: Number,
    required: true,
    min: 1000, // Minimum 1 second
    max: 3600000 // Maximum 1 hour
  },
  maxRequests: {
    type: Number,
    required: true,
    min: 1,
    max: 10000
  },
  message: {
    type: String,
    default: 'Too many requests, please try again later.'
  }
}, { _id: false });

/**
 * API Key Schema
 */
const apiKeySchema = new Schema<IApiKey>({
  // Key identification
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  key: {
    type: String,
    unique: true,
    index: true
  },
  keyPrefix: {
    type: String,
    index: true
  },
  
  // Security configuration
  domainWhitelist: {
    type: [String],
    required: true,
    validate: {
      validator: function(domains: string[]): boolean {
        return domains.length <= API_KEY_CONFIG.MAX_DOMAINS_PER_KEY;
      },
      message: `Maximum ${API_KEY_CONFIG.MAX_DOMAINS_PER_KEY} domains allowed per API key`
    }
  },
  allowWildcardSubdomains: {
    type: Boolean,
    default: false
  },
  
  // Rate limiting
  rateLimits: {
    global: {
      type: rateLimitConfigSchema,
      required: true,
      default: RATE_LIMIT_DEFAULTS.GLOBAL
    },
    endpoints: {
      type: Map,
      of: rateLimitConfigSchema,
      default: new Map(Object.entries(RATE_LIMIT_DEFAULTS.ENDPOINTS))
    }
  },
  
  // Key lifecycle
  isActive: {
    type: Boolean,
    required: true,
    default: true,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  lastUsedAt: {
    type: Date,
    index: true
  },
  rotatedFrom: {
    type: String,
    ref: 'ApiKey'
  },
  rotatedAt: Date,
  
  // Usage analytics
  usage: {
    totalRequests: {
      type: Number,
      default: 0,
      min: 0
    },
    lastResetAt: {
      type: Date,
      default: Date.now
    },
    endpoints: {
      type: Schema.Types.Mixed,
      default: (): Record<string, number> => ({})
    }
  },
  
  // Metadata
  createdBy: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    maxlength: 500
  },
  tags: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Indexes for performance
apiKeySchema.index({ isActive: 1, keyPrefix: 1 });
apiKeySchema.index({ domainWhitelist: 1 });
apiKeySchema.index({ createdAt: -1 });
apiKeySchema.index({ lastUsedAt: -1 });
apiKeySchema.index({ expiresAt: 1 }, { sparse: true });

// Virtual for checking if key is expired
apiKeySchema.virtual('isExpired').get(function(this: IApiKey): boolean {
  return Boolean(this.expiresAt && this.expiresAt <= new Date());
});

// Virtual for checking if rotation is needed
apiKeySchema.virtual('needsRotation').get(function(this: IApiKey): boolean {
  if (this.createdAt == null) return false;
  
  const daysSinceCreation = Math.floor(
    (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceCreation >= API_KEY_CONFIG.ROTATION_DAYS;
});

// Pre-save middleware
apiKeySchema.pre('save', function(this: IApiKey, next): void {
  // Generate and hash API key if new
  if (this.isNew && this.key == null) {
    const rawKey = encryptionService.generateSecureToken(API_KEY_CONFIG.KEY_LENGTH);
    
    // Store hashed key (without salt for simplicity in validation)
    this.key = encryptionService.hash(rawKey);
    
    // Store prefix for identification
    this.keyPrefix = rawKey.substring(0, API_KEY_CONFIG.PREFIX_LENGTH);
    
    // Return the raw key to the caller (only time it's available)
    (this as IApiKey & { _rawKey?: string })._rawKey = rawKey;
  }
  
  // Set default expiration if not set
  if (this.expiresAt == null && API_KEY_CONFIG.ROTATION_DAYS > 0) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + API_KEY_CONFIG.ROTATION_DAYS);
    this.expiresAt = expirationDate;
  }
  
  next();
});

// Instance methods
apiKeySchema.methods.validateKey = function(this: IApiKey, rawKey: string): boolean {
  // Check if key matches prefix
  if (!rawKey.startsWith(this.keyPrefix)) {
    return false;
  }
  
  // Hash the provided key and compare with stored hash
  try {
    const hashedProvidedKey = encryptionService.hash(rawKey);
    return hashedProvidedKey === this.key;
  } catch {
    return false;
  }
};

apiKeySchema.methods.validateDomain = function(this: IApiKey, domain: string): boolean {
  if (this.isActive !== true || this.isExpired === true) {
    return false;
  }
  
  if (this.domainWhitelist == null || !Array.isArray(this.domainWhitelist)) {
    return false;
  }
  
  return this.domainWhitelist.some((whitelistedDomain: string) => {
    // Normalize by stripping protocol prefixes and trailing slashes
    const cleanedWhitelistedDomain = whitelistedDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    
    // Handle wildcard subdomains
    if (cleanedWhitelistedDomain.startsWith('*.')) {
      const baseDomain = cleanedWhitelistedDomain.slice(2);
      return domain === baseDomain || domain.endsWith(`.${baseDomain}`);
    }

    // Exact match
    return domain === cleanedWhitelistedDomain;
  });
};

apiKeySchema.methods.incrementUsage = function(this: IApiKey, endpoint?: string): Promise<IApiKey> {
  // Ensure usage object exists
  this.usage ??= {
    totalRequests: 0,
    lastResetAt: new Date(),
    endpoints: {}
  } as IApiKey['usage'];
  
  // Create safe accessor to prevent object injection
  const getEndpointValue = (key: string): number => {
    switch (key) {
    case '/api/widget/v1/config':
    case '/api/widget/v1/locations':
    case '/api/widget/v1/bookings': {
      const endpoints = this.usage.endpoints;
      if (typeof endpoints === 'object' && endpoints != null) {
        const endpointsRecord = endpoints;
        switch (key) {
        case '/api/widget/v1/config':
          return endpointsRecord['/api/widget/v1/config'] ?? 0;
        case '/api/widget/v1/locations':
          return endpointsRecord['/api/widget/v1/locations'] ?? 0;
        case '/api/widget/v1/bookings':
          return endpointsRecord['/api/widget/v1/bookings'] ?? 0;
        default:
          return 0;
        }
      }
      return 0;
    }
    default:
      return 0;
    }
  };
  
  const setEndpointValue = (key: string, value: number): void => {
    switch (key) {
    case '/api/widget/v1/config':
    case '/api/widget/v1/locations':
    case '/api/widget/v1/bookings': {
      const endpoints = this.usage.endpoints;
      if (typeof endpoints === 'object' && endpoints != null) {
        const endpointsRecord = endpoints;
        switch (key) {
        case '/api/widget/v1/config':
          endpointsRecord['/api/widget/v1/config'] = value;
          break;
        case '/api/widget/v1/locations':
          endpointsRecord['/api/widget/v1/locations'] = value;
          break;
        case '/api/widget/v1/bookings':
          endpointsRecord['/api/widget/v1/bookings'] = value;
          break;
        default:
          // Ignore unknown keys to prevent injection
          break;
        }
      }
      break;
    }
    // Ignore other keys to prevent injection
    default:
      break;
    }
  };
  
  this.usage.totalRequests += 1;
  
  if (endpoint != null && endpoint.length > 0) {
    const currentCount = getEndpointValue(endpoint);
    setEndpointValue(endpoint, currentCount + 1);
  }
  
  this.lastUsedAt = new Date();
  
  // Monthly reset logic
  const daysSinceReset = Math.floor(
    (Date.now() - this.usage.lastResetAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (!Number.isNaN(daysSinceReset) && daysSinceReset >= 30) {
    this.usage.totalRequests = 1;
    this.usage.endpoints = endpoint != null && endpoint.length > 0 ? { [endpoint]: 1 } : {};
    this.usage.lastResetAt = new Date();
  }
  
  return this.save();
};

apiKeySchema.methods.rotate = function(this: IApiKey, createdBy: string): Promise<string> {
  // Create new API key
  const newKeyData: Partial<IApiKey> = {
    name: `${this.name} (Rotated)`,
    domainWhitelist: Array.isArray(this.domainWhitelist) ? [...this.domainWhitelist] : [],
    allowWildcardSubdomains: this.allowWildcardSubdomains,
    rateLimits: this.rateLimits,
    createdBy,
    rotatedFrom: this._id?.toString(),
    rotatedAt: new Date(),
    tags: Array.isArray(this.tags) ? [...this.tags, 'rotated'] : ['rotated']
  };
  
  const newKey = new ApiKey(newKeyData);
  
  // Deactivate current key
  this.isActive = false;
  
  return Promise.all([this.save(), newKey.save()]).then(([, savedNewKey]) => {
    // Return the raw key from the new key
    return (savedNewKey as IApiKey & { _rawKey?: string })._rawKey ?? '';
  });
};

// Static methods
apiKeySchema.statics.findByPrefix = function(prefix: string): Promise<IApiKey | null> {
  return this.findOne({ 
    keyPrefix: prefix,
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

apiKeySchema.statics.findActive = function(): Promise<IApiKey[]> {
  return this.find({ 
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

apiKeySchema.statics.cleanupExpired = function(): Promise<{ deletedCount?: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DATA_RETENTION_PERIODS.API_KEY_USAGE);
  
  return this.deleteMany({
    isActive: false,
    expiresAt: { $lt: cutoffDate }
  });
};

// Export model
export const ApiKey = model<IApiKey>('ApiKey', apiKeySchema); 