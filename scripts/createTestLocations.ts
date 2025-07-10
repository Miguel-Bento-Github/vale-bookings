import mongoose from 'mongoose';
import Location from '../src/models/Location';

// Test locations data (all in Leiden, Netherlands - less mainstream locations)
const testLocations = [
  {
    name: 'Pieterskerk Square Cafe',
    address: 'Pieterskerkhof 9, 2311 SL Leiden, Netherlands',
    coordinates: {
      latitude: 52.1583,
      longitude: 4.4924
    },
    services: ['standard-valet', 'premium-valet'],
    isActive: true,
    operatingHours: {
      monday: { open: '08:00', close: '18:00' },
      tuesday: { open: '08:00', close: '18:00' },
      wednesday: { open: '08:00', close: '18:00' },
      thursday: { open: '08:00', close: '18:00' },
      friday: { open: '08:00', close: '20:00' },
      saturday: { open: '09:00', close: '20:00' },
      sunday: { open: '10:00', close: '17:00' }
    }
  },
  {
    name: 'Botanical Gardens Workshop',
    address: 'Rapenburg 73, 2311 GJ Leiden, Netherlands',
    coordinates: {
      latitude: 52.1579,
      longitude: 4.4857
    },
    services: ['standard-valet'],
    isActive: true,
    operatingHours: {
      monday: { open: '10:00', close: '17:00' },
      tuesday: { open: '10:00', close: '17:00' },
      wednesday: { open: '10:00', close: '17:00' },
      thursday: { open: '10:00', close: '17:00' },
      friday: { open: '10:00', close: '17:00' },
      saturday: { open: '10:00', close: '17:00' },
      sunday: { open: '10:00', close: '17:00' }
    }
  },
  {
    name: 'Breestraat Book Corner',
    address: 'Breestraat 45, 2311 CS Leiden, Netherlands',
    coordinates: {
      latitude: 52.1604,
      longitude: 4.4931
    },
    services: ['standard-valet', 'premium-valet'],
    isActive: true,
    operatingHours: {
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { open: '09:00', close: '19:00' },
      saturday: { open: '10:00', close: '19:00' },
      sunday: { open: '12:00', close: '17:00' }
    }
  }
];

async function createTestLocations() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vale_db');
    console.log('Connected to MongoDB');

    // Clear existing test locations with the same names
    await Location.deleteMany({ name: { $in: testLocations.map(loc => loc.name) } });
    console.log('Cleared existing test locations with matching names');

    // Create new test locations
    const createdLocations = await Location.insertMany(testLocations);
    console.log(`Created ${createdLocations.length} test locations:`);
    
    createdLocations.forEach(location => {
      console.log(`- ${location.name} (${location._id})`);
    });

    console.log('Test locations created successfully!');
  } catch (error) {
    console.error('Error creating test locations:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createTestLocations(); 