import type { Job } from 'agenda';
import { Agenda } from 'agenda';
import Bull from 'bull';
import mongoose from 'mongoose';

import { DATABASE_CONFIG } from '../constants/database';
import { logInfo, logWarning, logError } from '../utils/logger';

// Queue configuration
interface QueueConfig {
  provider: 'bull' | 'agenda';
  redis?: {
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
export interface JobData {
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

// Global queue instances
let bullQueue: Bull.Queue | null = null;
let agendaInstance: Agenda | null = null;

// Get queue configuration from environment
const getQueueConfig = (): QueueConfig => {
  // In test environment, use the in-memory MongoDB instance
  const isTestEnv = process.env.NODE_ENV === 'test';
  const mongoUrl = isTestEnv 
    ? DATABASE_CONFIG.MONGODB_TEST_VALE_DB
    : DATABASE_CONFIG.MONGODB_URL;

  return {
    provider: (process.env.QUEUE_PROVIDER as 'bull' | 'agenda') ?? 'bull',
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB ?? '0')
    },
    mongodb: {
      url: mongoUrl,
      collection: process.env.QUEUE_COLLECTION ?? 'agenda_jobs'
    }
  };
};

// Initialize Bull queue
const initializeBullQueue = (): Bull.Queue => {
  if (bullQueue) {
    return bullQueue;
  }

  const config = getQueueConfig();
  
  if (!config.redis) {
    throw new Error('Redis configuration is required for Bull queue');
  }

  const redisConfig = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db
  };

  bullQueue = new Bull('vale-queue', {
    redis: redisConfig,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  });

  // Handle queue events
  bullQueue.on('error', (error) => {
    logError('Bull queue error', { error: error.message });
  });

  bullQueue.on('waiting', (jobId) => {
    logInfo('Job waiting', { jobId: jobId.toString() });
  });

  bullQueue.on('active', (job) => {
    logInfo('Job started', { jobId: job.id?.toString(), jobType: job.name });
  });

  bullQueue.on('completed', (job) => {
    logInfo('Job completed', { jobId: job.id?.toString(), jobType: job.name });
  });

  bullQueue.on('failed', (job, error) => {
    logError('Job failed', { jobId: job.id?.toString(), jobType: job.name, error: error.message });
  });

  return bullQueue;
};

// Initialize Agenda instance
const initializeAgenda = (): Agenda => {
  if (agendaInstance) {
    return agendaInstance;
  }

  const config = getQueueConfig();
  
  if (!config.mongodb) {
    throw new Error('MongoDB configuration is required for Agenda');
  }

  // Production code - use real Agenda with in-memory MongoDB for tests
  agendaInstance = new Agenda({
    db: {
      address: config.mongodb.url,
      collection: config.mongodb.collection
    },
    processEvery: '30 seconds',
    maxConcurrency: 20
  });

  // Set up connection timeout to prevent hanging connections
  agendaInstance.on('ready', () => {
    logInfo('Agenda is ready');
  });

  agendaInstance.on('error', (error: Error) => {
    logError('Agenda error', { error: error.message });
  });

  // Handle agenda events
  agendaInstance.on('start', (job: Job) => {
    logInfo('Agenda job started', { jobId: String(job.attrs._id), jobType: job.attrs.name });
  });

  agendaInstance.on('complete', (job: Job) => {
    logInfo('Agenda job completed', { jobId: String(job.attrs._id), jobType: job.attrs.name });
  });

  agendaInstance.on('fail', (error: Error, job: Job) => {
    logError('Agenda job failed', {
      jobId: String(job.attrs._id),
      jobType: job.attrs.name,
      error: error.message
    });
  });

  return agendaInstance;
};

// Real Bull Queue implementation
const scheduleWithBull = async (
  jobId: string,
  scheduledFor: Date,
  jobType: string,
  data: JobData
): Promise<JobResult> => {
  try {
    const queue = initializeBullQueue();
    
    logInfo('Scheduling job with Bull', { jobId, jobType, scheduledFor });
    
    const delay = scheduledFor.getTime() - Date.now();
    
    if (delay <= 0) {
      return {
        success: false,
        error: 'Scheduled time must be in the future'
      };
    }

    const job = await queue.add(jobType, data, {
      delay,
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
    
    logInfo('Job scheduled successfully with Bull', { jobId: job.id, scheduledFor });
    
    return {
      success: true,
      jobId: job.id.toString(),
      scheduledFor
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Bull error';
    logError('Bull job scheduling failed', { error: errorMessage, jobId });
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Real Agenda implementation
const scheduleWithAgenda = async (
  jobId: string,
  scheduledFor: Date,
  jobType: string,
  data: JobData
): Promise<JobResult> => {
  try {
    const agenda = initializeAgenda();

    // Ensure Agenda is started before scheduling jobs
    if (typeof agenda._processInterval === 'undefined' || agenda._processInterval === null) {
      await agenda.start();
    }
    
    logInfo('Scheduling job with Agenda', { jobId, jobType, scheduledFor });
    
    // Define job processor if not already defined
    if (!Object.prototype.hasOwnProperty.call(agenda._definitions, jobType)) {
      agenda.define(jobType, async (job: Job) => {
        logInfo('Processing Agenda job', {
          jobId: String(job.attrs._id),
          jobType: job.attrs.name,
          data: job.attrs.data
        });
        
        // In production, you would call your actual job handlers here
        // For example: await notificationService.sendReminder(job.attrs.data);
        
        // Simulate work (skip in test environment)
        if (process.env.NODE_ENV !== 'test') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      });
    }
    
    const job = await agenda.schedule(scheduledFor, jobType, data);
    await job.save();
    
    logInfo('Job scheduled successfully with Agenda', { jobId: String(job.attrs._id), scheduledFor });
    
    return {
      success: true,
      jobId: job.attrs._id.toString(),
      scheduledFor
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Agenda error';
    logError('Agenda job scheduling failed', { error: errorMessage, jobId });
    
    return {
      success: false,
      error: errorMessage
    };
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
    if (typeof jobType !== 'string' || jobType.length === 0) {
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
      logError('Unsupported queue provider', { provider: String(config.provider ?? 'unknown') });
      return {
        success: false,
        error: `Unsupported queue provider: ${String(config.provider ?? 'unknown')}`
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
export const cancelJob = async (jobId: string): Promise<boolean> => {
  try {
    const config = getQueueConfig();
    
    logInfo('Cancelling job', { jobId, provider: config.provider });
    
    switch (config.provider) {
    case 'bull': {
      const queue = initializeBullQueue();
      const job = await queue.getJob(jobId);
      
      if (!job) {
        logWarning('Job not found for cancellation', { jobId });
        return false;
      }
      
      await job.remove();
      logInfo('Job cancelled successfully with Bull', { jobId });
      return true;
    }
    
    case 'agenda': {
      const agenda = initializeAgenda();
      if (typeof jobId !== 'string' || jobId.length === 0) {
        return false;
      }
      
      // First check the job status to see if it can be cancelled
      const jobs = await agenda.jobs({ _id: new mongoose.Types.ObjectId(jobId) });
      if (!Array.isArray(jobs) || jobs.length === 0) {
        logWarning('Job not found for cancellation', { jobId: String(jobId) });
        return false;
      }
      
      const agendaJob = jobs[0];
      if (!agendaJob) {
        logWarning('Job not found for cancellation', { jobId: String(jobId) });
        return false;
      }
      
      // Check if the job is already completed or failed
      if (agendaJob.attrs.lastRunAt || agendaJob.attrs.failedAt || 
          (typeof agendaJob.attrs.failReason === 'string' && agendaJob.attrs.failReason.length > 0)) {
        logWarning('Cannot cancel completed or failed job', { jobId: String(jobId) });
        return false;
      }
      
      const result = await agenda.cancel({ _id: new mongoose.Types.ObjectId(jobId) });
      if (typeof result !== 'number' || result === 0) {
        logWarning('Job not found for cancellation', { jobId: String(jobId) });
        return false;
      }
      logInfo('Job cancelled successfully with Agenda', { jobId: String(jobId) });
      return true;
    }
    
    default:
      logError('Unsupported queue provider for cancellation', { provider: String(config.provider ?? 'unknown') });
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Job cancellation failed', { error: errorMessage, jobId });
    return false;
  }
};

// Get job status
export const getJobStatus = async (jobId: string): Promise<{
  exists: boolean;
  status?: string;
  scheduledFor?: Date;
  data?: JobData;
  error?: string;
}> => {
  try {
    const config = getQueueConfig();
    
    logInfo('Getting job status', { jobId, provider: config.provider });
    
    switch (config.provider) {
    case 'bull': {
      const queue = initializeBullQueue();
      const job = await queue.getJob(jobId);
      
      if (!job) {
        return { exists: false };
      }
      
      const state = await job.getState();
      const delay = job.opts.delay ?? 0;
      const scheduledFor = delay > 0 ? new Date(Date.now() + delay) : undefined;
      
      return {
        exists: true,
        status: state,
        scheduledFor,
        data: job.data as JobData
      };
    }
    
    case 'agenda': {
      const agenda = initializeAgenda();
      const jobs = await agenda.jobs({ _id: new mongoose.Types.ObjectId(jobId) });
      if (!Array.isArray(jobs) || jobs.length === 0) {
        return { exists: false };
      }
      const agendaJob = jobs[0];
      if (!agendaJob) {
        return { exists: false };
      }
      let status = 'scheduled';
      if (typeof agendaJob.attrs.failReason === 'string' && agendaJob.attrs.failReason.length > 0) {
        status = 'failed';
      } else if (agendaJob.attrs.failedAt) {
        status = 'failed';
      } else if (agendaJob.attrs.lastRunAt) {
        status = 'completed';
      }
      return {
        exists: true,
        status,
        scheduledFor: agendaJob.attrs.nextRunAt ?? undefined,
        data: agendaJob.attrs.data as JobData
      };
    }
    
    default:
      return {
        exists: false,
        error: `Unsupported queue provider: ${String(config.provider ?? 'unknown')}`
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Getting job status failed', { error: errorMessage, jobId });
    
    return {
      exists: false,
      error: errorMessage
    };
  }
};

// List jobs (for debugging/monitoring)
export const listJobs = async (options: {
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
    const config = getQueueConfig();
    const { status, type, limit = 50, offset = 0 } = options;
    
    logInfo('Listing jobs', { ...options, provider: config.provider });
    
    switch (config.provider) {
    case 'bull': {
      const queue = initializeBullQueue();
      const jobs = await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed']);
      
      let filteredJobs = jobs;
      
      if (typeof type === 'string' && type.length > 0) {
        filteredJobs = filteredJobs.filter(job => job.name === type);
      }
      
      const total = filteredJobs.length;
      const sortedJobs = filteredJobs.sort((a, b) => b.timestamp - a.timestamp);
      const slicedJobs = sortedJobs.slice(offset, offset + limit);
      
      const paginatedJobs = await Promise.all(slicedJobs.map(async job => ({
        id: String(job.id),
        type: job.name,
        status: await job.getState(),
        scheduledFor: (job.opts.delay ?? 0) > 0 
          ? new Date(Date.now() + (job.opts.delay ?? 0)) 
          : new Date(job.timestamp),
        createdAt: new Date(job.timestamp)
      })));
      
      return { jobs: paginatedJobs, total };
    }
    
    case 'agenda': {
      const agenda = initializeAgenda();
      const query: Record<string, unknown> = {};
      
      if (typeof type === 'string' && type.length > 0) {
        query.name = type;
      }
      
      const jobs = await agenda.jobs(query);
      
      let filteredJobs = jobs;
      
      if (typeof status === 'string' && status.length > 0) {
        filteredJobs = jobs.filter(job => {
          const jobStatus = typeof job.attrs.failReason === 'string' && job.attrs.failReason.length > 0
            ? 'failed'
            : job.attrs.failedAt !== null && job.attrs.failedAt !== undefined
              ? 'failed'
              : job.attrs.lastRunAt !== null && job.attrs.lastRunAt !== undefined
                ? 'completed'
                : 'scheduled';
          return jobStatus === status;
        });
      }
      
      const total = filteredJobs.length;
      const paginatedJobs = filteredJobs
        .sort((a, b) => (b.attrs.lastRunAt?.getTime() ?? 0) - (a.attrs.lastRunAt?.getTime() ?? 0))
        .slice(offset, offset + limit)
        .map(job => ({
          id: job.attrs._id !== null && job.attrs._id !== undefined ? String(job.attrs._id) : '',
          type: job.attrs.name,
          status: typeof job.attrs.failReason === 'string' && job.attrs.failReason.length > 0
            ? 'failed'
            : job.attrs.failedAt !== null && job.attrs.failedAt !== undefined
              ? 'failed'
              : job.attrs.lastRunAt !== null && job.attrs.lastRunAt !== undefined
                ? 'completed'
                : 'scheduled',
          scheduledFor: job.attrs.nextRunAt ?? new Date(),
          createdAt: job.attrs.lastRunAt ?? new Date()
        }));
      
      return { jobs: paginatedJobs, total };
    }
    
    default:
      return { jobs: [], total: 0 };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Listing jobs failed', { error: errorMessage });
    
    return { jobs: [], total: 0 };
  }
};

// Process jobs manually (for testing)
export const processJob = async (jobId: string): Promise<boolean> => {
  try {
    const config = getQueueConfig();
    
    logInfo('Processing job manually', { jobId, provider: config.provider });
    
    switch (config.provider) {
    case 'bull': {
      const queue = initializeBullQueue();
      const job = await queue.getJob(jobId);
      
      if (!job) {
        logWarning('Job not found for processing', { jobId });
        return false;
      }
      
      const state = await job.getState();
      if (state !== 'delayed' && state !== 'waiting') {
        logWarning('Job is not in processable state', { jobId, state });
        return false;
      }
      
      // For Bull, we can't manually process jobs, but we can move them to active state
      // by removing and re-adding with immediate execution
      await job.remove();
      const newJob = await queue.add(job.name, job.data, { 
        attempts: job.opts.attempts,
        backoff: job.opts.backoff
      });
      
      logInfo('Job processed successfully with Bull', { jobId: newJob.id.toString() });
      return true;
    }
    
    case 'agenda': {
      const agenda = initializeAgenda();
      const jobs = await agenda.jobs({ _id: new mongoose.Types.ObjectId(jobId) });
      
      if (!Array.isArray(jobs) || jobs.length === 0) {
        logWarning('Job not found for processing', { jobId });
        return false;
      }
      
      const job = jobs[0];
      if (!job) {
        logWarning('Job not found for processing', { jobId });
        return false;
      }
      
      // Check if job is already completed or failed
      if (job.attrs.lastRunAt || job.attrs.failedAt || 
          (typeof job.attrs.failReason === 'string' && job.attrs.failReason.length > 0)) {
        logWarning('Job is not in processable state', { jobId });
        return false;
      }
      
      await job.run();
      
      logInfo('Job processed successfully with Agenda', { jobId });
      return true;
    }
    
    default:
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Job processing error', { error: errorMessage, jobId });
    return false;
  }
};

// Clean up completed/failed jobs
export const cleanupJobs = async (olderThanDays: number = 7): Promise<number> => {
  try {
    const config = getQueueConfig();
    
    logInfo('Cleaning up old jobs', { olderThanDays, provider: config.provider });
    
    switch (config.provider) {
    case 'bull': {
      // Bull automatically removes completed/failed jobs based on defaultJobOptions
      // This is handled by the removeOnComplete and removeOnFail settings
      logInfo('Bull cleanup handled automatically by defaultJobOptions');
      return 0;
    }
    
    case 'agenda': {
      const agenda = initializeAgenda();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const result = await agenda.jobs({
        $or: [
          { lastRunAt: { $lt: cutoffDate } },
          { failedAt: { $lt: cutoffDate } }
        ]
      });
      
      let cleanedCount = 0;
      for (const job of result) {
        await job.remove();
        cleanedCount++;
      }
      
      logInfo('Agenda cleanup completed', { cleanedCount, olderThanDays });
      return cleanedCount;
    }
    
    default:
      return 0;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Job cleanup failed', { error: errorMessage });
    return 0;
  }
};

// Get queue health status
export const getQueueHealth = async (): Promise<{
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
    
    switch (config.provider) {
    case 'bull': {
      const queue = initializeBullQueue();
      
      const [, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed()
      ]);
      
      const jobCounts = {
        scheduled: delayed.length,
        running: active.length,
        completed: completed.length,
        failed: failed.length,
        cancelled: 0 // Bull doesn't have a cancelled state
      };
      
      logInfo('Bull queue health check', { provider: config.provider, jobCounts });
      
      return {
        healthy: true,
        provider: config.provider,
        jobCounts
      };
    }
    
    case 'agenda': {
      const agenda = initializeAgenda();
      
      const jobs = await agenda.jobs({});
      const jobCounts = {
        scheduled: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      };
      
      for (const job of jobs) {
        if ((typeof job.attrs.failReason === 'string' && job.attrs.failReason.length > 0) || job.attrs.failedAt) {
          jobCounts.failed++;
        } else if (job.attrs.lastRunAt) {
          jobCounts.completed++;
        } else {
          jobCounts.scheduled++;
        }
      }
      
      logInfo('Agenda queue health check', { provider: config.provider, jobCounts });
      
      return {
        healthy: true,
        provider: config.provider,
        jobCounts
      };
    }
    
    default:
      return {
        healthy: false,
        provider: 'unknown',
        jobCounts: { scheduled: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
        error: `Unsupported queue provider: ${String(config.provider ?? 'unknown')}`
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Queue health check failed', { error: errorMessage });
    
    return {
      healthy: false,
      provider: 'unknown',
      jobCounts: { scheduled: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
      error: errorMessage
    };
  }
};

// Graceful shutdown
export const shutdown = async (): Promise<void> => {
  try {
    const config = getQueueConfig();
    
    logInfo('Shutting down queue service', { provider: config.provider });
    
    switch (config.provider) {
    case 'bull':
      if (bullQueue) {
        try {
          await bullQueue.close();
        } catch (bullError) {
          logError('Bull cleanup error', { error: bullError instanceof Error ? bullError.message : 'Unknown' });
        } finally {
          bullQueue = null;
        }
      }
      break;
      
    case 'agenda':
      if (agendaInstance) {
        try {
          // Remove all event listeners to prevent memory leaks
          agendaInstance.removeAllListeners();
          
          // Stop the agenda instance
          await agendaInstance.stop();
          
          // Close the database connection
          await agendaInstance.close();
          

          
        } catch (agendaError) {
          // Log but don't throw - Agenda cleanup errors shouldn't prevent shutdown
          logError('Agenda cleanup error', { error: agendaError instanceof Error ? agendaError.message : 'Unknown' });
        } finally {
          agendaInstance = null;
        }
      }
      break;
      
    default:
      logWarning('Unknown queue provider during shutdown', { provider: String(config.provider ?? 'unknown') });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('Queue service shutdown failed', { error: errorMessage });
  }
}; 