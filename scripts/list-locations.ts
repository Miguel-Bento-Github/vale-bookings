import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../src/constants/database';

// Import the Location model
const Location = require('../dist/src/models/Location').default;

async function listLocations(): Promise<void> {
  try {
    // Connect to MongoDB
    await mongoose.connect(DATABASE_CONFIG.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all locations
    const locations = await Location.find({});
    
    console.log('\n📍 Available Locations:');
    console.log('========================');
    
    if (locations.length === 0) {
      console.log('No locations found in database.');
      console.log('Run: npx tsx scripts/createTestLocations.ts');
    } else {
      locations.forEach((location: any, index: number) => {
        console.log(`${index + 1}. ${location.name}`);
        console.log(`   ID: ${location._id}`);
        console.log(`   Active: ${location.isActive ? '✅' : '❌'}`);
        console.log(`   Address: ${location.address}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error:', (error as Error).message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
listLocations(); 