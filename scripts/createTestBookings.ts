import mongoose from 'mongoose';
import Booking from '../src/models/Booking';
import User from '../src/models/User';
import Location from '../src/models/Location';
import { DATABASE_CONFIG } from '../src/constants/database';

async function createTestBookings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(DATABASE_CONFIG.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get existing test data
    const users = await User.find({});
    const locations = await Location.find({
      name: { 
        $in: [
          'Pieterskerk Square Cafe',
          'Botanical Gardens Workshop', 
          'Breestraat Book Corner'
        ]
      }
    });

    if (users.length === 0) {
      console.log('No users found. Please create users first.');
      return;
    }

    if (locations.length === 0) {
      console.log('No test locations found. Please run createTestLocations.ts first.');
      return;
    }

    console.log(`Found ${users.length} users and ${locations.length} locations`);

    // Clear existing test bookings
    await Booking.deleteMany({});
    console.log('Cleared existing bookings');

    // Create test bookings
    const bookings: Array<{
      userId: mongoose.Types.ObjectId;
      locationId: mongoose.Types.ObjectId;
      startTime: Date;
      endTime: Date;
      status: string;
      price: number;
      notes?: string;
    }> = [];
    const now = new Date();

    // Create bookings for the next 30 days
    for (let i = 0; i < 15; i++) {
      const user = users[i % users.length];
      const location = locations[i % locations.length];
      
      // Create booking for a future date
      const bookingDate = new Date(now);
      bookingDate.setDate(bookingDate.getDate() + Math.floor(Math.random() * 30) + 1);
      
      // Random time between 9 AM and 5 PM
      const startHour = 9 + Math.floor(Math.random() * 8);
      const startMinute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
      
      const startTime = new Date(bookingDate);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setHours(startHour + 1 + Math.floor(Math.random() * 3), startMinute, 0, 0);
      
      // Random status
      const statuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Random price between 15 and 50 euros
      const price = 15 + Math.floor(Math.random() * 36);
      
      // Random notes (sometimes)
      const notes = Math.random() > 0.7 ? [
        'Please park near the entrance',
        'Customer prefers covered parking',
        'Large vehicle - SUV',
        'Electric vehicle charging preferred',
        'Customer will arrive 10 minutes early'
      ][Math.floor(Math.random() * 5)] : undefined;

      bookings.push({
        userId: user._id,
        locationId: location._id,
        startTime,
        endTime,
        status,
        price,
        notes
      });
    }

    // Insert all bookings
    const createdBookings = await Booking.insertMany(bookings);
    console.log(`Created ${createdBookings.length} test bookings`);

    // Display summary by status
    const statusCounts = createdBookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nBooking status summary:');
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  - ${status}: ${count}`);
    }

    // Display some sample bookings
    console.log('\nSample bookings:');
    const sampleBookings = createdBookings.slice(0, 5);
    for (const booking of sampleBookings) {
      const user = users.find(u => u._id.toString() === booking.userId.toString());
      const location = locations.find(l => l._id.toString() === booking.locationId.toString());
      
      console.log(`  - ${user?.profile?.name || user?.email} at ${location?.name}`);
      console.log(`    ${booking.startTime.toLocaleDateString()} ${booking.startTime.toLocaleTimeString()} - ${booking.endTime.toLocaleTimeString()}`);
      console.log(`    Status: ${booking.status}, Price: €${booking.price}`);
      if (booking.notes) {
        console.log(`    Notes: ${booking.notes}`);
      }
      console.log('');
    }

    console.log('Test bookings created successfully!');
  } catch (error) {
    console.error('Error creating test bookings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createTestBookings(); 