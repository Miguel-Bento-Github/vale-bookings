import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import User from '../models/User';

async function createAdminUser(): Promise<void> {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/vale_db';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@vale.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = new User({
      email: 'admin@vale.com',
      password: hashedPassword,
      role: 'ADMIN',
      profile: {
        name: 'Admin User'
      }
    });

    await adminUser.save();
    console.log('Admin user created successfully');
    console.log('Email: admin@vale.com');
    console.log('Password: admin123');

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