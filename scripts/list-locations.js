const mongoose = require('mongoose');

// Import the Location model
const Location = require('../dist/src/models/Location').default;

async function listLocations() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/vale_test');
    console.log('Connected to MongoDB');

    // Find all locations
    const locations = await Location.find({});
    
    console.log('\n📍 Available Locations:');
    console.log('========================');
    
    if (locations.length === 0) {
      console.log('No locations found in database.');
      console.log('Run: npx tsx scripts/createTestLocations.ts');
    } else {
      locations.forEach((location, index) => {
        console.log(`${index + 1}. ${location.name}`);
        console.log(`   ID: ${location._id}`);
        console.log(`   Active: ${location.isActive ? '✅' : '❌'}`);
        console.log(`   Address: ${location.address}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

listLocations(); 