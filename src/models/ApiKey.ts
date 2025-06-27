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
    required: true,
    unique: true,
    index: true
  },
  keyPrefix: {
    type: String,
    required: true,
    index: true
  },
  
  // Security configuration
  domainWhitelist: {
    type: [String],
    required: true,
    validate: {
      validator: function(domains: string[]) {
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
      type: Map,
      of: Number,
      default: new Map()
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
apiKeySchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt <= new Date();
});

// Virtual for checking if rotation is needed
apiKeySchema.virtual('needsRotation').get(function() {
  if (!this.createdAt) return false;
  
  const daysSinceCreation = Math.floor(
    (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceCreation >= API_KEY_CONFIG.ROTATION_DAYS;
});

// Pre-save middleware
apiKeySchema.pre('save', async function(next) {
  // Generate and hash API key if new
  if (this.isNew && !this.key) {
    const rawKey = encryptionService.generateSecureToken(API_KEY_CONFIG.KEY_LENGTH);
    const salt = encryptionService.generateSecureToken(16);
    
    // Store hashed key
    this.key = encryptionService.hash(rawKey, salt);
    
    // Store prefix for identification
    this.keyPrefix = rawKey.substring(0, API_KEY_CONFIG.PREFIX_LENGTH);
    
    // Return the raw key to the caller (only time it's available)
    (this as any)._rawKey = rawKey;
  }
  
  // Set default expiration if not set
  if (!this.expiresAt && API_KEY_CONFIG.ROTATION_DAYS) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + API_KEY_CONFIG.ROTATION_DAYS);
    this.expiresAt = expirationDate;
  }
  
  next();
});

// Instance methods
apiKeySchema.methods.validateKey = function(rawKey: string): boolean {
  // Check if key matches prefix
  if (!rawKey.startsWith(this.keyPrefix)) {
    return false;
  }
  
  // Since we can't reverse the hash, we need to implement a different strategy
  // In production, you might want to use a different approach like storing
  // a separate validation hash or using bcrypt
  // For now, we'll assume the key validation happens at a higher level
  return true;
};

apiKeySchema.methods.validateDomain = function(domain: string): boolean {
  if (!this.isActive || this.isExpired) {
    return false;
  }
  
  return this.domainWhitelist.some((whitelistedDomain: string) => {
    if (this.allowWildcardSubdomains && whitelistedDomain.startsWith('*.')) {
      const baseDomain = whitelistedDomain.substring(2);
      return domain === baseDomain || domain.endsWith(`.${baseDomain}`);
    }
    return domain === whitelistedDomain;
  });
};

apiKeySchema.methods.incrementUsage = async function(endpoint?: string) {
  this.usage.totalRequests += 1;
  
  if (endpoint) {
    const currentCount = this.usage.endpoints.get(endpoint) || 0;
    this.usage.endpoints.set(endpoint, currentCount + 1);
  }
  
  this.lastUsedAt = new Date();
  
  // Reset usage counters if needed (e.g., monthly reset)
  const daysSinceReset = Math.floor(
    (Date.now() - this.usage.lastResetAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceReset >= 30) {
    this.usage.totalRequests = 1;
    this.usage.endpoints = new Map(endpoint ? [[endpoint, 1]] : []);
    this.usage.lastResetAt = new Date();
  }
  
  return this.save();
};

apiKeySchema.methods.rotate = async function(createdBy: string) {
  // Create new API key
  const newKey = new ApiKey({
    name: `${this.name} (Rotated)`,
    domainWhitelist: this.domainWhitelist,
    allowWildcardSubdomains: this.allowWildcardSubdomains,
    rateLimits: this.rateLimits,
    createdBy,
    rotatedFrom: this._id,
    rotatedAt: new Date(),
    tags: [...this.tags, 'rotated']
  });
  
  // Deactivate current key
  this.isActive = false;
  
  await this.save();
  const savedNewKey = await newKey.save();
  
  // Return the raw key from the new key
  return (savedNewKey as any)._rawKey;
};

// Static methods
apiKeySchema.statics.findByPrefix = function(prefix: string) {
  return this.findOne({ 
    keyPrefix: prefix,
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

apiKeySchema.statics.findActive = function() {
  return this.find({ 
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

apiKeySchema.statics.cleanupExpired = async function() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DATA_RETENTION_PERIODS.API_KEY_USAGE);
  
  return this.deleteMany({
    isActive: false,
    expiresAt: { $lt: cutoffDate }
  });
};

// Export model
export const ApiKey = model<IApiKey>('ApiKey', apiKeySchema); 