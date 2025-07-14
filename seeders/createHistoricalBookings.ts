import mongoose from 'mongoose';
import User from '../src/models/User';
import Location from '../src/models/Location';
import { DATABASE_CONFIG } from '../src/constants/database';

async function createHistoricalBookings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(DATABASE_CONFIG.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get existing test data - only customer users for bookings
    const customers = await User.find({ role: 'CUSTOMER' });
    const locations = await Location.find({
      name: { 
        $in: [
          'Pieterskerk Square Cafe',
          'Botanical Gardens Workshop', 
          'Breestraat Book Corner'
        ]
      }
    });

    if (customers.length === 0) {
      console.log('No customer users found. Please run createTestUsers.ts first.');
      return;
    }

    if (locations.length === 0) {
      console.log('No test locations found. Please run createTestLocations.ts first.');
      return;
    }

    console.log(`Found ${customers.length} customer users and ${locations.length} locations`);

    // Create historical bookings using direct collection insertion to bypass validation
    const bookingsCollection = mongoose.connection.collection('bookings');
    
    const now = new Date();
    const historicalBookings = [];
    
    // Create 30 historical bookings spanning the last 60 days
    for (let i = 0; i < 30; i++) {
      const customer = customers[i % customers.length];
      const location = locations[i % locations.length];
      
      // Create bookings from 60 days ago to yesterday
      const daysOffset = -60 + (i * 2); // Spread across past 60 days
      const bookingDate = new Date(now);
      bookingDate.setDate(bookingDate.getDate() + daysOffset);
      
      // Business hours: 8 AM to 6 PM
      const startHour = 8 + Math.floor(Math.random() * 10);
      const startMinute = Math.floor(Math.random() * 4) * 15;
      
      const startTime = new Date(bookingDate);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      const duration = 1 + Math.floor(Math.random() * 3);
      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + duration);
      
      // Historical bookings: mostly completed, some cancelled
      const status = Math.random() < 0.85 ? 'COMPLETED' : 'CANCELLED';
      
      // Price based on location
      let basePrice: number;
      if (location.name === 'Pieterskerk Square Cafe') {
        basePrice = 25;
      } else if (location.name === 'Botanical Gardens Workshop') {
        basePrice = 20;
      } else {
        basePrice = 30;
      }
      
      const price = Math.round((basePrice * duration) + (Math.random() * 10 - 5));
      
      historicalBookings.push({
        _id: new mongoose.Types.ObjectId(),
        userId: customer._id,
        locationId: location._id,
        startTime,
        endTime,
        status,
        price,
        notes: Math.random() > 0.7 ? `Historical booking for ${customer.profile?.name?.split(' ')[0]}` : undefined,
        createdAt: startTime, // Set creation time to match booking time for realism
        updatedAt: endTime
      });
    }
    
    // Insert historical bookings directly into collection
    if (historicalBookings.length > 0) {
      await bookingsCollection.insertMany(historicalBookings);
      console.log(`Created ${historicalBookings.length} historical bookings`);
      
      // Display summary
      const completedCount = historicalBookings.filter(b => b.status === 'COMPLETED').length;
      const cancelledCount = historicalBookings.filter(b => b.status === 'CANCELLED').length;
      const totalRevenue = historicalBookings
        .filter(b => b.status === 'COMPLETED')
        .reduce((sum, b) => sum + b.price, 0);
      
      console.log('\nHistorical booking summary:');
      console.log(`  - Completed: ${completedCount}`);
      console.log(`  - Cancelled: ${cancelledCount}`);
      console.log(`  - Total historical revenue: €${totalRevenue}`);
      
      console.log('\n✅ Historical bookings created for better analytics data!');
    }
    
  } catch (error) {
    console.error('Error creating historical bookings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createHistoricalBookings();