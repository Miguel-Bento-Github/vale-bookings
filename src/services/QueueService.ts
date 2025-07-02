import { logInfo, logWarning, logError } from '../utils/logger';

// Queue configuration
interface QueueConfig {
  provider: 'bull' | 'agenda';
  redict?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  mongodb?: {
    url: string;
    collection?: string;
  };
}

// Job data interface
interface JobData {
  [key: string]: unknown;
  booking?: Record<string, unknown>;
  channels?: string[];
  language?: string;
}

// Job result interface
interface JobResult {
  success: boolean;
  jobId?: string;
  scheduledFor?: Date;
  error?: string;
}

// Mock job storage for demonstration
const mockJobs = new Map<string, {
  id: string;
  type: string;
  data: JobData;
  scheduledFor: Date;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}>();

// Get queue configuration from environment
const getQueueConfig = (): QueueConfig => {
  return {
    provider: (process.env.QUEUE_PROVIDER as 'bull' | 'agenda') ?? 'bull',
    redict: {
      host: process.env.REDICT_HOST ?? 'localhost',
      port: parseInt(process.env.REDICT_PORT ?? '6379'),
      password: process.env.REDICT_PASSWORD,
      db: parseInt(process.env.REDICT_DB ?? '0')
    },
    mongodb: {
      url: process.env.MONGODB_URL ?? 'mongodb://localhost:27017/vale',
      collection: process.env.QUEUE_COLLECTION ?? 'agenda_jobs'
    }
  };
};

// Generate unique job ID (currently unused but kept for future use)
// const generateJobId = (): string => {
//   return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
// };

// Mock Bull Queue implementation
const scheduleWithBull = (
  jobId: string,
  scheduledFor: Date,
  jobType: string,
  data: JobData
): Promise<JobResult> => {
  try {
    logInfo('Scheduling job with Bull', { jobId, jobType, scheduledFor });
    
    // In real implementation, you would use Bull Queue:
    // const queue = new Bull('notifications', { redis: config.redis });
    // const job = await queue.add(jobType, data, { delay: scheduledFor.getTime() - Date.now() });
    
    // Mock implementation
    const job = {
      id: jobId,
      type: jobType,
      data,
      scheduledFor,
      status: 'scheduled' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mockJobs.set(jobId, job);
    
    logInfo('Job scheduled successfully with Bull', { jobId, scheduledFor });
    
    return Promise.resolve({
      success: true,
      jobId,
      scheduledFor
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Bull error';
    logError('Bull job scheduling failed', { error: errorMessage, jobId });
    
    return Promise.resolve({
      success: false,
      error: errorMessage
    });
  }
};

// Mock Agenda implementation
const scheduleWithAgenda = (
  jobId: string,
  scheduledFor: Date,
  jobType: string,
  data: JobData
): Promise<JobResult> => {
  try {
    logInfo('Scheduling job with Agenda', { jobId, jobType, scheduledFor });
    
    // In real implementation, you would use Agenda:
    // const agenda = new Agenda({ db: { address: config.mongodb.url } });
    // await agenda.schedule(scheduledFor, jobType, data);
    
    // Mock implementation
    const job = {
      id: jobId,
      type: jobType,
      data,
      scheduledFor,
      status: 'scheduled' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mockJobs.set(jobId, job);
    
    logInfo('Job scheduled successfully with Agenda', { jobId, scheduledFor });
    
    return Promise.resolve({
      success: true,
      jobId,
      scheduledFor
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Agenda error';
    logError('Agenda job scheduling failed', { error: errorMessage, jobId });
    
    return Promise.resolve({
      success: false,
      error: errorMessage
    });
  }
};

// Schedule a job
export const scheduleJob = async (
  jobId: string,
  scheduledFor: Date,
  jobType: string,
  data: JobData
): Promise<JobResult> => {
  try {
    const config = getQueueConfig();
    
    // Validate scheduled time
    if (scheduledFor <= new Date()) {
      return {
        success: false,
        error: 'Scheduled time must be in the future'
      };
    }
    
    // Validate job data
    if (!jobType || typeof jobType !== 'string' || jobType.length === 0) {
      return {
        success: false,
        error: 'Job type is required'
      };
    }
    
    logInfo('Scheduling job', { jobId, jobType, scheduledFor, provider: config.provider });
    
    // Route to appropriate queue provider
    switch (config.provider) {
    case 'bull':
      return await scheduleWithBull(jobId, scheduledFor, jobType, data);
    case 'agenda':
      return await scheduleWithAgenda(jobId, scheduledFor, jobType, data);
    default:
      logError('Unsupported queue provider', { provider: String(config.provider) });
      return {
        success: false,
        error: `Unsupported queue provider: ${String(config.provider)}`
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown queue error';
    logError('Job scheduling failed', { error: errorMessage, jobId });
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Cancel a scheduled job
export const cancelJob = (jobId: string): Promise<boolean> => {
  try {
    logInfo('Cancelling job', { jobId });
    
    // Check if job exists in mock storage
    const job = mockJobs.get(jobId);
    if (job == null) {
      logWarning('Job not found for cancellation', { jobId });
      return Promise.resolve(false);
    }
    
    // Check if job can be cancelled
    if (job.status === 'completed' || job.status === 'failed') {
      logWarning('Cannot cancel completed or failed job', { jobId, status: job.status });
      return Promise.resolve(false);
    }
    
    // In real implementation, you would:
    // For Bull: const job = await queue.getJob(jobId); await job.remove();
    // For Agenda: await agenda.cancel({ _id: jobId });
    
    // Mock cancellation
    job.status = 'cancelled';
    job.updatedAt = new Date();
    
    logInfo('Job cancelled successfully', { jobId });
    return Promise.resolve(true);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Job cancellation failed', { error: errorMessage, jobId });
    return Promise.resolve(false);
  }
};

// Get job status
export const getJobStatus = (jobId: string): Promise<{
  exists: boolean;
  status?: string;
  scheduledFor?: Date;
  data?: JobData;
  error?: string;
}> => {
  try {
    logInfo('Getting job status', { jobId });
    
    const job = mockJobs.get(jobId);
    if (job == null) {
      return Promise.resolve({ exists: false });
    }
    
    return Promise.resolve({
      exists: true,
      status: job.status,
      scheduledFor: job.scheduledFor,
      data: job.data
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Getting job status failed', { error: errorMessage, jobId });
    
    return Promise.resolve({
      exists: false,
      error: errorMessage
    });
  }
};

// List jobs (for debugging/monitoring)
export const listJobs = (options: {
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{
  jobs: Array<{
    id: string;
    type: string;
    status: string;
    scheduledFor: Date;
    createdAt: Date;
  }>;
  total: number;
}> => {
  try {
    const { status, type, limit = 50, offset = 0 } = options;
    
    logInfo('Listing jobs', options);
    
    let jobs = Array.from(mockJobs.values());
    
    // Apply filters
    if (status != null && status !== '') {
      jobs = jobs.filter(job => job.status === status);
    }
    
    if (type != null && type !== '') {
      jobs = jobs.filter(job => job.type === type);
    }
    
    // Apply pagination
    const total = jobs.length;
    const paginatedJobs = jobs
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit)
      .map(job => ({
        id: job.id,
        type: job.type,
        status: job.status,
        scheduledFor: job.scheduledFor,
        createdAt: job.createdAt
      }));
    
    return Promise.resolve({
      jobs: paginatedJobs,
      total
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Listing jobs failed', { error: errorMessage });
    
    return Promise.resolve({
      jobs: [],
      total: 0
    });
  }
};

// Process jobs manually (for testing)
export const processJob = async (jobId: string): Promise<boolean> => {
  try {
    logInfo('Processing job manually', { jobId });
    
    const job = mockJobs.get(jobId);
    if (!job) {
      logWarning('Job not found for processing', { jobId });
      return false;
    }
    
    if (job.status !== 'scheduled') {
      logWarning('Job is not in scheduled status', { jobId, status: job.status });
      return false;
    }
    
    // Update job status
    job.status = 'running';
    job.updatedAt = new Date();
    
    // Simulate job processing
    try {
      // In real implementation, this would execute the actual job logic
      // For booking reminders, it would call the notification service
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
      
      job.status = 'completed';
      job.updatedAt = new Date();
      
      logInfo('Job processed successfully', { jobId });
      return true;
    } catch (processingError) {
      job.status = 'failed';
      job.updatedAt = new Date();
      
      const errorMessage = processingError instanceof Error ? processingError.message : 'Processing failed';
      logError('Job processing failed', { error: errorMessage, jobId });
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Job processing error', { error: errorMessage, jobId });
    return false;
  }
};

// Clean up completed/failed jobs
export const cleanupJobs = (olderThanDays: number = 7): Promise<number> => {
  try {
    logInfo('Cleaning up old jobs', { olderThanDays });
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let cleanedCount = 0;
    
    for (const [jobId, job] of mockJobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.updatedAt < cutoffDate
      ) {
        mockJobs.delete(jobId);
        cleanedCount++;
      }
    }
    
    logInfo('Job cleanup completed', { cleanedCount, olderThanDays });
    return Promise.resolve(cleanedCount);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Job cleanup failed', { error: errorMessage });
    return Promise.resolve(0);
  }
};

// Get queue health status
export const getQueueHealth = (): Promise<{
  healthy: boolean;
  provider: string;
  jobCounts: {
    scheduled: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  error?: string;
}> => {
  try {
    const config = getQueueConfig();
    
    // Count jobs by status
    const jobCounts = {
      scheduled: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };
    
    for (const job of mockJobs.values()) {
      jobCounts[job.status]++;
    }
    
    logInfo('Queue health check', { provider: config.provider, jobCounts });
    
    return Promise.resolve({
      healthy: true,
      provider: config.provider,
      jobCounts
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Queue health check failed', { error: errorMessage });
    
    return Promise.resolve({
      healthy: false,
      provider: 'unknown',
      jobCounts: {
        scheduled: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      },
      error: errorMessage
    });
  }
}; 