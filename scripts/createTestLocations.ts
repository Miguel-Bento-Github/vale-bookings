import mongoose from 'mongoose';
import Location from '../src/models/Location';

// Test locations data
const testLocations = [
  {
    name: 'Downtown Parking',
    address: '123 Main St, San Francisco, CA 94102',
    coordinates: {
      latitude: 37.7749,
      longitude: -122.4194
    },
    services: ['standard-valet', 'premium-valet'],
    isActive: true,
    operatingHours: {
      monday: { open: '06:00', close: '22:00' },
      tuesday: { open: '06:00', close: '22:00' },
      wednesday: { open: '06:00', close: '22:00' },
      thursday: { open: '06:00', close: '22:00' },
      friday: { open: '06:00', close: '22:00' },
      saturday: { open: '07:00', close: '21:00' },
      sunday: { open: '07:00', close: '21:00' }
    }
  },
  {
    name: 'Airport Valet',
    address: '456 Airport Blvd, San Francisco, CA 94128',
    coordinates: {
      latitude: 37.6213,
      longitude: -122.3790
    },
    services: ['standard-valet', 'premium-valet'],
    isActive: true,
    operatingHours: {
      monday: { open: '04:00', close: '24:00' },
      tuesday: { open: '04:00', close: '24:00' },
      wednesday: { open: '04:00', close: '24:00' },
      thursday: { open: '04:00', close: '24:00' },
      friday: { open: '04:00', close: '24:00' },
      saturday: { open: '04:00', close: '24:00' },
      sunday: { open: '04:00', close: '24:00' }
    }
  },
  {
    name: 'Shopping Center',
    address: '789 Market St, San Francisco, CA 94103',
    coordinates: {
      latitude: 37.7849,
      longitude: -122.4094
    },
    services: ['standard-valet'],
    isActive: true,
    operatingHours: {
      monday: { open: '09:00', close: '21:00' },
      tuesday: { open: '09:00', close: '21:00' },
      wednesday: { open: '09:00', close: '21:00' },
      thursday: { open: '09:00', close: '21:00' },
      friday: { open: '09:00', close: '22:00' },
      saturday: { open: '09:00', close: '22:00' },
      sunday: { open: '10:00', close: '20:00' }
    }
  }
];

async function createTestLocations() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vale-test');
    console.log('Connected to MongoDB');

    // Clear existing test locations
    await Location.deleteMany({ name: { $in: testLocations.map(loc => loc.name) } });
    console.log('Cleared existing test locations');

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