import { hash } from 'bcryptjs';
import mongoose from 'mongoose';

import { DATABASE_CONFIG } from '../constants/database';
import User from '../models/User';

async function createAdminUser(): Promise<void> {
  try {
    // Connect to MongoDB - use test URI in test environment
    const mongoUri = process.env.NODE_ENV === 'test' 
      ? DATABASE_CONFIG.MONGODB_TEST_URI 
      : DATABASE_CONFIG.MONGODB_URI;
    await mongoose.connect(mongoUri);
    process.stdout.write('Connected to MongoDB\n');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@vale.com' });
    if (existingAdmin) {
      process.stdout.write('Admin user already exists\n');
      return;
    }

    // Create admin user
    const hashedPassword = await hash('admin123', 10);
    const adminUser = new User({
      email: 'admin@vale.com',
      password: hashedPassword,
      role: 'ADMIN',
      profile: {
        name: 'Admin User'
      }
    });

    await adminUser.save();
    process.stdout.write('Admin user created successfully\n');
    process.stdout.write('Email: admin@vale.com\n');
    process.stdout.write('Password: admin123\n');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  void createAdminUser();
}

export default createAdminUser; 