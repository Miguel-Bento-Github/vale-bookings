# Production-Ready Queue System

This document describes the production-ready queue system implemented in the Vale backend, which supports both Bull (Redis-based) and Agenda (MongoDB-based) queue providers.

## Overview

The queue system provides a robust, scalable solution for handling background jobs, scheduled tasks, and asynchronous processing. It supports:

- **Job Scheduling**: Schedule jobs to run at specific times
- **Job Cancellation**: Cancel scheduled jobs
- **Job Monitoring**: Check job status and list jobs
- **Queue Health**: Monitor queue health and performance
- **Graceful Shutdown**: Properly shut down the queue system
- **Multiple Providers**: Support for Bull (Redis) and Agenda (MongoDB)

## Architecture

### Components

1. **QueueService** (`src/services/QueueService.ts`): Core queue management service
2. **JobProcessor** (`src/services/JobProcessor.ts`): High-level job scheduling interface
3. **Job Types**: Predefined job types for common use cases

### Queue Providers

#### Bull (Redis-based)
- **Pros**: High performance, Redis persistence, built-in retry logic, job prioritization
- **Cons**: Requires Redis infrastructure
- **Best for**: High-throughput applications, real-time processing

#### Agenda (MongoDB-based)
- **Pros**: MongoDB integration, flexible scheduling, lightweight
- **Cons**: Lower performance than Bull, MongoDB dependency
- **Best for**: Applications already using MongoDB, simpler setups

## Configuration

### Environment Variables

```bash
# Queue provider (bull or agenda)
QUEUE_PROVIDER=bull

# Redis configuration (for Bull)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# MongoDB configuration (for Agenda)
MONGODB_URL=mongodb://localhost:27017/vale_db
QUEUE_COLLECTION=agenda_jobs
```

### Default Configuration

- **Provider**: Bull (if not specified)
- **Redis Host**: localhost
- **Redis Port**: 6379
- **MongoDB URL**: mongodb://localhost:27017/vale_db
- **Queue Collection**: agenda_jobs

## Usage

### Basic Job Scheduling

```typescript
import { jobProcessor } from '../services/JobProcessor';

// Schedule a simple job
const jobId = await jobProcessor.scheduleEmailNotification({
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome',
  data: { name: 'John' },
  priority: 'normal'
}, new Date(Date.now() + 5 * 60 * 1000)); // 5 minutes from now
```

### Booking Reminders

```typescript
import { scheduleBookingReminders } from '../services/JobProcessor';

const bookingData = {
  bookingId: 'booking_123',
  customerId: 'customer_456',
  customerEmail: 'customer@example.com',
  customerPhone: '+1234567890',
  bookingDate: new Date('2024-02-15T14:00:00Z'),
  location: 'Downtown Garage'
};

// This schedules 24h, 1h, and 15min reminders automatically
const reminders = await scheduleBookingReminders(bookingData);
```

### Payment Reminders

```typescript
import { schedulePaymentReminders } from '../services/JobProcessor';

const paymentData = {
  bookingId: 'booking_123',
  customerId: 'customer_456',
  customerEmail: 'customer@example.com',
  amount: 25.00,
  currency: 'USD',
  dueDate: new Date('2024-02-10T23:59:59Z')
};

const reminderId = await schedulePaymentReminders(paymentData);
```

### Job Management

```typescript
// Check job status
const status = await jobProcessor.getJobStatus(jobId);

// Cancel a job
const cancelled = await jobProcessor.cancelJob(jobId);

// List jobs
const jobs = await jobProcessor.listJobs({
  status: 'scheduled',
  type: 'email_notification',
  limit: 10,
  offset: 0
});

// Get queue health
const health = await jobProcessor.getQueueHealth();
```

## Job Types

### Available Job Types

1. **booking_reminder**: Send booking reminders to customers
2. **payment_reminder**: Send payment reminders
3. **email_notification**: Send email notifications
4. **sms_notification**: Send SMS notifications
5. **data_cleanup**: Clean up old data
6. **report_generation**: Generate reports

### Custom Job Types

You can create custom job types by extending the system:

```typescript
// Define custom job data
interface CustomJobData {
  customField: string;
  timestamp: Date;
}

// Schedule custom job
const jobId = await scheduleJob(
  'custom_job_id',
  new Date(Date.now() + 60 * 1000), // 1 minute from now
  'custom_job_type',
  { customField: 'value', timestamp: new Date() } as unknown as JobData
);
```

## Integration with Application

### Application Startup

```typescript
import { setupJobProcessors } from './examples/queue-usage-example';

// In your main application file
async function startApplication() {
  // Initialize your database connections
  await connectDatabase();
  
  // Setup job processors
  await setupJobProcessors();
  
  // Start your Express server
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
```

### Graceful Shutdown

```typescript
import { gracefulShutdown } from './examples/queue-usage-example';

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

## Production Considerations

### Redis Setup (for Bull)

1. **Install Redis**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # macOS
   brew install redis
   ```

2. **Configure Redis**:
   ```bash
   # Start Redis
   redis-server
   
   # Test connection
   redis-cli ping
   ```

3. **Redis Persistence**:
   ```bash
   # Enable AOF persistence
   redis-cli config set appendonly yes
   ```

### MongoDB Setup (for Agenda)

1. **Install MongoDB**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mongodb
   
   # macOS
   brew install mongodb-community
   ```

2. **Start MongoDB**:
   ```bash
   # Start MongoDB service
   sudo systemctl start mongodb
   
   # Or manually
   mongod --dbpath /var/lib/mongodb
   ```

### Monitoring

#### Queue Health Monitoring

```typescript
// Regular health checks
setInterval(async () => {
  const health = await jobProcessor.getQueueHealth();
  
  if (!health.healthy) {
    console.error('Queue health check failed:', health.error);
    // Send alert to monitoring system
  }
  
  console.log('Queue health:', health.jobCounts);
}, 60000); // Check every minute
```

#### Job Monitoring

```typescript
// Monitor failed jobs
setInterval(async () => {
  const failedJobs = await jobProcessor.listJobs({
    status: 'failed',
    limit: 100
  });
  
  if (failedJobs.jobs.length > 0) {
    console.warn('Failed jobs detected:', failedJobs.jobs.length);
    // Send alert to monitoring system
  }
}, 300000); // Check every 5 minutes
```

### Scaling

#### Horizontal Scaling

For high-throughput applications, you can run multiple instances:

1. **Shared Redis/MongoDB**: All instances connect to the same database
2. **Load Balancing**: Jobs are automatically distributed across instances
3. **Job Deduplication**: Use unique job IDs to prevent duplicate processing

#### Vertical Scaling

1. **Increase Concurrency**: Adjust `maxConcurrency` in Agenda configuration
2. **Optimize Redis**: Increase Redis memory and connection limits
3. **Database Optimization**: Index job collections for better performance

## Testing

### Unit Testing

```typescript
import { jobProcessor } from '../services/JobProcessor';

describe('JobProcessor', () => {
  it('should schedule a job successfully', async () => {
    const jobId = await jobProcessor.scheduleEmailNotification({
      to: 'test@example.com',
      subject: 'Test',
      template: 'test',
      data: {},
      priority: 'normal'
    }, new Date(Date.now() + 1000));
    
    expect(jobId).toBeDefined();
    
    const status = await jobProcessor.getJobStatus(jobId);
    expect(status.exists).toBe(true);
  });
});
```

### Integration Testing

```typescript
// Test with real Redis/MongoDB
describe('Queue Integration', () => {
  beforeAll(async () => {
    // Setup test database
  });
  
  afterAll(async () => {
    // Cleanup test database
    await jobProcessor.shutdown();
  });
  
  it('should process jobs end-to-end', async () => {
    // Test complete job lifecycle
  });
});
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**:
   - Check Redis server is running
   - Verify connection settings
   - Check firewall rules

2. **MongoDB Connection Failed**:
   - Check MongoDB server is running
   - Verify connection string
   - Check authentication

3. **Jobs Not Processing**:
   - Check queue health
   - Verify job processors are set up
   - Check for errors in logs

4. **High Memory Usage**:
   - Reduce `removeOnComplete` and `removeOnFail` settings
   - Implement job cleanup
   - Monitor job queue size

### Debugging

```typescript
// Enable debug logging
process.env.DEBUG = 'bull:*';

// Check job details
const job = await queue.getJob(jobId);
console.log('Job details:', job.toJSON());

// List all jobs
const allJobs = await jobProcessor.listJobs();
console.log('All jobs:', allJobs);
```

## Performance Optimization

### Best Practices

1. **Job Batching**: Group related jobs together
2. **Job Prioritization**: Use priority levels for important jobs
3. **Retry Logic**: Implement exponential backoff for failed jobs
4. **Job Cleanup**: Regularly clean up completed/failed jobs
5. **Monitoring**: Monitor queue performance and health

### Configuration Tuning

```typescript
// Bull configuration optimization
const queue = new Bull('vale-queue', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 50,    // Keep fewer completed jobs
    removeOnFail: 25,        // Keep fewer failed jobs
    attempts: 3,             // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000            // Start with 2 second delay
    }
  }
});

// Agenda configuration optimization
const agenda = new Agenda({
  db: { address: mongoUrl },
  processEvery: '30 seconds',  // Check for jobs every 30 seconds
  maxConcurrency: 20,          // Process up to 20 jobs concurrently
  defaultConcurrency: 5        // Default concurrency per job type
});
```

## Security Considerations

1. **Redis Security**:
   - Use strong passwords
   - Enable SSL/TLS
   - Restrict network access

2. **MongoDB Security**:
   - Use authentication
   - Enable SSL/TLS
   - Restrict network access

3. **Job Data Security**:
   - Validate job data
   - Sanitize inputs
   - Use encryption for sensitive data

## Migration Guide

### From Mock Implementation

If you're migrating from the mock implementation:

1. **Install Dependencies**:
   ```bash
   npm install bull agenda @types/bull
   ```

2. **Update Configuration**:
   - Set `QUEUE_PROVIDER` environment variable
   - Configure Redis/MongoDB connection

3. **Update Code**:
   - Replace mock service calls with real service calls
   - Update job data types if needed

4. **Test Thoroughly**:
   - Test job scheduling
   - Test job processing
   - Test error handling

### Between Queue Providers

To switch between Bull and Agenda:

1. **Update Environment**:
   ```bash
   QUEUE_PROVIDER=bull  # or agenda
   ```

2. **Update Configuration**:
   - Configure Redis for Bull
   - Configure MongoDB for Agenda

3. **Migrate Existing Jobs**:
   - Export jobs from current provider
   - Import jobs to new provider
   - Verify job integrity

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review logs for error messages
3. Check queue health status
4. Consult Bull/Agenda documentation
5. Create an issue in the project repository 