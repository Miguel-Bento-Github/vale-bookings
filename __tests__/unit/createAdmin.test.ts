import { hash } from 'bcryptjs';
import mongoose from 'mongoose';

import User from '../../src/models/User';
import createAdminUser from '../../src/scripts/createAdmin';

// Mock User model before importing createAdminUser
jest.mock('../../src/models/User', () => {
  const mockUser = jest.fn().mockImplementation(() => ({
    save: jest.fn()
  }));
  (mockUser as unknown as { findOne: jest.Mock }).findOne = jest.fn();
  return mockUser;
});

// Mock other dependencies
jest.mock('mongoose');
jest.mock('bcryptjs');

const mockMongoose = mongoose as jest.Mocked<typeof mongoose>;
const mockHash = hash as jest.MockedFunction<typeof hash>;
const mockUser = User as unknown as jest.Mock & { findOne: jest.Mock };

// Mock process.stdout.write
const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

describe('createAdminUser script', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MONGODB_URI = 'mongodb://test:27017/test_db';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.MONGODB_URI;
  });

  it('should create admin user successfully when none exists', async () => {
    // Mock successful database operations
    mockMongoose.connect.mockResolvedValueOnce(undefined as unknown as typeof mongoose);
    mockMongoose.disconnect.mockResolvedValueOnce(undefined as unknown as void);
    (mockUser.findOne).mockResolvedValueOnce(null);
    (mockHash as jest.Mock).mockResolvedValueOnce('hashed_password');

    const mockSave = jest.fn().mockResolvedValueOnce({});
    (mockUser as jest.Mock).mockImplementationOnce(() => ({
      save: mockSave
    }));

    await createAdminUser();

    expect(mockMongoose.connect).toHaveBeenCalledWith('mongodb://test:27017/test_db');
    expect(mockUser.findOne).toHaveBeenCalledWith({ email: 'admin@vale.com' });
    expect(mockHash).toHaveBeenCalledWith('admin123', 10);
    expect(mockUser).toHaveBeenCalledWith({
      email: 'admin@vale.com',
      password: 'hashed_password',
      role: 'ADMIN',
      profile: {
        name: 'Admin User'
      }
    });
    expect(mockSave).toHaveBeenCalled();
    expect(mockMongoose.disconnect).toHaveBeenCalled();

    expect(mockStdoutWrite).toHaveBeenCalledWith('Connected to MongoDB\n');
    expect(mockStdoutWrite).toHaveBeenCalledWith('Admin user created successfully\n');
    expect(mockStdoutWrite).toHaveBeenCalledWith('Email: admin@vale.com\n');
    expect(mockStdoutWrite).toHaveBeenCalledWith('Password: admin123\n');
  });

  it('should use default MongoDB URI when MONGODB_URI is not set', async () => {
    delete process.env.MONGODB_URI;

    mockMongoose.connect.mockResolvedValueOnce(undefined as unknown as typeof mongoose);
    mockMongoose.disconnect.mockResolvedValueOnce(undefined as unknown as void);
    (mockUser.findOne).mockResolvedValueOnce(null);
    (mockHash as jest.Mock).mockResolvedValueOnce('hashed_password');

    const mockSave = jest.fn().mockResolvedValueOnce({});
    (mockUser as jest.Mock).mockImplementationOnce(() => ({
      save: mockSave
    }));

    await createAdminUser();

    expect(mockMongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/vale_db');
  });

  it('should skip creation when admin user already exists', async () => {
    const existingAdmin = {
      email: 'admin@vale.com',
      role: 'ADMIN'
    };

    mockMongoose.connect.mockResolvedValueOnce(undefined as unknown as typeof mongoose);
    mockMongoose.disconnect.mockResolvedValueOnce(undefined as unknown as void);
    (mockUser.findOne).mockResolvedValueOnce(existingAdmin);

    await createAdminUser();

    expect(mockMongoose.connect).toHaveBeenCalledWith('mongodb://test:27017/test_db');
    expect(mockUser.findOne).toHaveBeenCalledWith({ email: 'admin@vale.com' });
    expect(mockHash).not.toHaveBeenCalled();
    expect(mockUser).not.toHaveBeenCalledWith(expect.objectContaining({
      email: 'admin@vale.com'
    }));
    expect(mockMongoose.disconnect).toHaveBeenCalled();

    expect(mockStdoutWrite).toHaveBeenCalledWith('Connected to MongoDB\n');
    expect(mockStdoutWrite).toHaveBeenCalledWith('Admin user already exists\n');
  });

  it('should handle errors gracefully and still disconnect', async () => {
    const error = new Error('Database connection failed');

    mockMongoose.connect.mockRejectedValueOnce(error);
    mockMongoose.disconnect.mockResolvedValueOnce(undefined as unknown as void);

    await createAdminUser();

    expect(mockMongoose.connect).toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith('Error creating admin user:', error);
    expect(mockMongoose.disconnect).toHaveBeenCalled();
  });

  it('should handle hash error gracefully', async () => {
    const error = new Error('Hash failed');

    mockMongoose.connect.mockResolvedValueOnce(undefined as unknown as typeof mongoose);
    mockMongoose.disconnect.mockResolvedValueOnce(undefined as unknown as void);
    (mockUser.findOne).mockResolvedValueOnce(null);
    (mockHash as jest.Mock).mockRejectedValueOnce(error);

    await createAdminUser();

    expect(mockMongoose.connect).toHaveBeenCalled();
    expect(mockUser.findOne).toHaveBeenCalledWith({ email: 'admin@vale.com' });
    expect(mockHash).toHaveBeenCalledWith('admin123', 10);
    expect(mockConsoleError).toHaveBeenCalledWith('Error creating admin user:', error);
    expect(mockMongoose.disconnect).toHaveBeenCalled();
  });

  it('should handle user save error gracefully', async () => {
    const error = new Error('Save failed');

    mockMongoose.connect.mockResolvedValueOnce(undefined as unknown as typeof mongoose);
    mockMongoose.disconnect.mockResolvedValueOnce(undefined as unknown as void);
    (mockUser.findOne).mockResolvedValueOnce(null);
    (mockHash as jest.Mock).mockResolvedValueOnce('hashed_password');

    const mockSave = jest.fn().mockRejectedValueOnce(error);
    (mockUser as jest.Mock).mockImplementationOnce(() => ({
      save: mockSave
    }));

    await createAdminUser();

    expect(mockMongoose.connect).toHaveBeenCalled();
    expect(mockUser.findOne).toHaveBeenCalledWith({ email: 'admin@vale.com' });
    expect(mockHash).toHaveBeenCalledWith('admin123', 10);
    expect(mockSave).toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith('Error creating admin user:', error);
    expect(mockMongoose.disconnect).toHaveBeenCalled();
  });
}); 