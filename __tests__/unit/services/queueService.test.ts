import { describe, it, expect, beforeEach } from '@jest/globals';

import {
  scheduleJob,
  cancelJob,
  getJobStatus,
  listJobs,
  processJob
} from '../../../src/services/QueueService';

// Helper to create future Date
const hoursFromNow = (h: number): Date => new Date(Date.now() + h * 60 * 60 * 1000);

describe('QueueService', () => {
  beforeEach(() => {
    // Ensure deterministic provider
    process.env.QUEUE_PROVIDER = 'bull';
  });

  it('schedules job successfully and retrieves status', async () => {
    const jobId = `job-test-${Date.now()}`;
    const scheduledFor = hoursFromNow(1);
    const result = await scheduleJob(jobId, scheduledFor, 'booking_reminder', { foo: 'bar' });
    expect(result.success).toBe(true);
    expect(result.jobId).toBe(jobId);

    const status = await getJobStatus(jobId);
    expect(status.exists).toBe(true);
    expect(status.status).toBe('scheduled');
    expect(status.scheduledFor?.getTime()).toBe(scheduledFor.getTime());
  });

  it('cancels a scheduled job', async () => {
    const jobId = `job-test-${Date.now()}-cancel`;
    await scheduleJob(jobId, hoursFromNow(2), 'booking_reminder', {});
    const cancelled = await cancelJob(jobId);
    expect(cancelled).toBe(true);

    const status = await getJobStatus(jobId);
    expect(status.exists).toBe(true);
    expect(status.status).toBe('cancelled');
  });

  it('rejects scheduling in the past', async () => {
    const jobId = 'job-past';
    const result = await scheduleJob(jobId, new Date(Date.now() - 1000), 'booking_reminder', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/future/i);
  });

  it('processes a job to completion', async () => {
    const jobId = `job-test-${Date.now()}-process`;
    await scheduleJob(jobId, hoursFromNow(0.001), 'booking_reminder', {});

    // Simulate immediate processing
    const processed = await processJob(jobId);
    expect(processed).toBe(true);

    const status = await getJobStatus(jobId);
    expect(status.status).toBe('completed');
  });

  it('lists jobs with filters', async () => {
    const list = await listJobs({ status: 'scheduled', limit: 10 });
    expect(Array.isArray(list.jobs)).toBe(true);
    expect(list.total).toBeGreaterThanOrEqual(0);
  });
}); 