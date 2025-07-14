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

    // Clear existing test bookings
    await Booking.deleteMany({});
    console.log('Cleared existing bookings');

    // Create realistic test bookings with better distribution
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
    
    // Create bookings spanning next 30 days for analytics
    const totalBookings = 45; // More bookings for better analytics
    
    for (let i = 0; i < totalBookings; i++) {
      // Cycle through customers and locations more evenly
      const customer = customers[i % customers.length];
      const location = locations[i % locations.length];
      
      // Create bookings from tomorrow to 30 days in the future (avoid past validation)
      const daysOffset = 1 + (i % 30); // Spread across next 30 days
      const bookingDate = new Date(now);
      bookingDate.setDate(bookingDate.getDate() + daysOffset);
      
      // Business hours: 8 AM to 6 PM (within location operating hours)
      const startHour = 8 + Math.floor(Math.random() * 10); // 8 AM to 5 PM start times
      const startMinute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
      
      const startTime = new Date(bookingDate);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      // Duration: 1-4 hours
      const duration = 1 + Math.floor(Math.random() * 3);
      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + duration);
      
      // Status distribution: realistic proportions for future bookings
      let status: string;
      const rand = Math.random();
      if (daysOffset <= 2) {
        // Very near future: mostly confirmed, some in progress
        status = rand < 0.7 ? 'CONFIRMED' : (rand < 0.9 ? 'IN_PROGRESS' : 'PENDING');
      } else if (daysOffset <= 7) {
        // Next week: mostly confirmed, some pending
        status = rand < 0.8 ? 'CONFIRMED' : 'PENDING';
      } else {
        // Further future: mix of confirmed and pending, some cancelled
        if (rand < 0.6) status = 'CONFIRMED';
        else if (rand < 0.85) status = 'PENDING';
        else status = 'CANCELLED';
      }
      
      // Price based on location and service type
      let basePrice: number;
      if (location.name === 'Pieterskerk Square Cafe') {
        basePrice = 25; // Premium location
      } else if (location.name === 'Botanical Gardens Workshop') {
        basePrice = 20; // Standard location
      } else {
        basePrice = 30; // Book corner - central location
      }
      
      // Add duration multiplier and small random variation
      const price = Math.round((basePrice * duration) + (Math.random() * 10 - 5));
      
      // Customer-specific notes (more realistic)
      let notes: string | undefined;
      if (Math.random() > 0.6) {
        const customerNotes = [
          `${customer.profile?.name?.split(' ')[0]} prefers spot near entrance`,
          'Electric vehicle - charging needed',
          'Large SUV - needs extra space',
          'Regular customer - VIP service',
          'Delivery expected during parking time',
          'Business meeting - quiet area preferred',
          'Tourist - first time visitor',
          'Local resident - monthly parking'
        ];
        notes = customerNotes[Math.floor(Math.random() * customerNotes.length)];
      }

      bookings.push({
        userId: customer._id,
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

    // Display analytics-friendly summary
    console.log('\nBooking analytics summary:');
    
    // Revenue summary
    const totalRevenue = createdBookings
      .filter(b => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + b.price, 0);
    console.log(`  - Total completed bookings revenue: €${totalRevenue}`);
    
    // Location distribution
    console.log('\nBookings by location:');
    const locationCounts = locations.map(location => {
      const count = createdBookings.filter(b => 
        b.locationId.toString() === location._id.toString()
      ).length;
      return { name: location.name, count };
    });
    locationCounts.forEach(loc => {
      console.log(`  - ${loc.name}: ${loc.count} bookings`);
    });
    
    // Customer engagement
    console.log('\nTop customers by bookings:');
    const customerCounts = customers.map(customer => {
      const count = createdBookings.filter(b => 
        b.userId.toString() === customer._id.toString()
      ).length;
      return { name: customer.profile?.name, count };
    }).sort((a, b) => b.count - a.count).slice(0, 5);
    customerCounts.forEach(customer => {
      console.log(`  - ${customer.name}: ${customer.count} bookings`);
    });

    // Display some sample bookings
    console.log('\nSample recent bookings:');
    const recentBookings = createdBookings
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, 3);
    
    for (const booking of recentBookings) {
      const customer = customers.find(u => u._id.toString() === booking.userId.toString());
      const location = locations.find(l => l._id.toString() === booking.locationId.toString());
      
      console.log(`  - ${customer?.profile?.name} at ${location?.name}`);
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