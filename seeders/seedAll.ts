import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../src/constants/database';

async function seedAll() {
  try {
    console.log('🌱 Starting database seeding...\n');
    
    // Connect to MongoDB
    await mongoose.connect(DATABASE_CONFIG.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('📋 Available seeders to run:');
    console.log('  1. npx tsx src/scripts/createAdmin.ts');
    console.log('  2. npx tsx seeders/createTestApiKey.ts');
    console.log('  3. npx tsx seeders/createTestLocations.ts');
    console.log('  4. npx tsx seeders/createTestSchedules.ts');
    console.log('  5. npx tsx seeders/createTestBookings.ts');
    console.log('  6. npx tsx seeders/createTestGuestBookings.ts');
    console.log('\n💡 Run these scripts in order for complete database seeding.');
    console.log('   Or run individual scripts as needed.\n');

    console.log('📋 Summary of data that will be seeded:');
    console.log('  - Admin user (admin@vale.com)');
    console.log('  - Test API key for widget development');
    console.log('  - 3 test locations in Leiden, Netherlands');
    console.log('  - Weekly schedules for each location');
    console.log('  - 15 test bookings with various statuses');
    console.log('  - 20 test guest bookings with GDPR compliance');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  seedAll();
}

export default seedAll; 