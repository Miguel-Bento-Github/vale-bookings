import mongoose from 'mongoose';
import { hash } from 'bcryptjs';
import User from '../src/models/User';
import { DATABASE_CONFIG } from '../src/constants/database';

// Test customer users data
const testCustomers = [
  {
    email: 'sarah.johnson@example.com',
    profile: {
      name: 'Sarah Johnson',
      phone: '+31-6-12345678'
    }
  },
  {
    email: 'mike.chen@example.com',
    profile: {
      name: 'Mike Chen',
      phone: '+31-6-23456789'
    }
  },
  {
    email: 'emma.van.der.berg@example.com',
    profile: {
      name: 'Emma van der Berg',
      phone: '+31-6-34567890'
    }
  },
  {
    email: 'david.smith@example.com',
    profile: {
      name: 'David Smith',
      phone: '+31-6-45678901'
    }
  },
  {
    email: 'anna.mueller@example.com',
    profile: {
      name: 'Anna Mueller',
      phone: '+31-6-56789012'
    }
  },
  {
    email: 'carlos.rodriguez@example.com',
    profile: {
      name: 'Carlos Rodriguez',
      phone: '+31-6-67890123'
    }
  },
  {
    email: 'lisa.wong@example.com',
    profile: {
      name: 'Lisa Wong',
      phone: '+31-6-78901234'
    }
  },
  {
    email: 'thomas.de.vries@example.com',
    profile: {
      name: 'Thomas de Vries',
      phone: '+31-6-89012345'
    }
  },
  {
    email: 'maria.santos@example.com',
    profile: {
      name: 'Maria Santos',
      phone: '+31-6-90123456'
    }
  },
  {
    email: 'john.anderson@example.com',
    profile: {
      name: 'John Anderson',
      phone: '+31-6-01234567'
    }
  }
];

async function createTestUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(DATABASE_CONFIG.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing test customer users (not admin)
    const testEmails = testCustomers.map(customer => customer.email);
    await User.deleteMany({ 
      email: { $in: testEmails },
      role: 'CUSTOMER' 
    });
    console.log('Cleared existing test customer users');

    // Create customer users with hashed passwords
    const hashedPassword = await hash('password123', 10);
    
    const usersToCreate = testCustomers.map(customer => ({
      email: customer.email,
      password: hashedPassword,
      role: 'CUSTOMER',
      profile: customer.profile,
      isEmailVerified: true, // For testing purposes
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Insert all test customer users
    const createdUsers = await User.insertMany(usersToCreate);
    console.log(`Created ${createdUsers.length} test customer users:`);
    
    createdUsers.forEach(user => {
      console.log(`- ${user.profile?.name} (${user.email})`);
    });

    console.log('\n📧 All test users can login with password: password123');
    console.log('\nTest customer users created successfully!');
  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createTestUsers();