import mongoose from 'mongoose';
import User from '../src/models/User';
import Location from '../src/models/Location';
import { DATABASE_CONFIG } from '../src/constants/database';

interface BookingStatus {
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  weight: number;
}

async function createAnalyticsData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(DATABASE_CONFIG.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing bookings for fresh data
    const bookingsCollection = mongoose.connection.collection('bookings');
    await bookingsCollection.deleteMany({});
    console.log('Cleared existing bookings');

    // Get existing test data
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

    const now = new Date();
    const allBookings: any[] = [];

    // Status distribution (realistic for a booking system)
    const statusDistribution: BookingStatus[] = [
      { status: 'COMPLETED', weight: 45 },    // 45% - most bookings are completed
      { status: 'CONFIRMED', weight: 28 },    // 28% - confirmed but not yet happened
      { status: 'PENDING', weight: 11 },      // 11% - pending confirmation
      { status: 'CANCELLED', weight: 9 },     // 9% - cancelled bookings
      { status: 'IN_PROGRESS', weight: 1 }    // 1% - currently in progress
    ];

    // Create weighted status selector
    function getRandomStatus(): string {
      const random = Math.random() * 100;
      let cumulative = 0;
      for (const { status, weight } of statusDistribution) {
        cumulative += weight;
        if (random <= cumulative) {
          return status;
        }
      }
      return 'COMPLETED';
    }

    // Location pricing and booking frequency
    const locationData = [
      { 
        name: 'Pieterskerk Square Cafe', 
        basePrice: 25, 
        popularity: 0.4,  // 40% of bookings
        peakDays: [1, 2, 3, 4, 5] // Monday to Friday
      },
      { 
        name: 'Botanical Gardens Workshop', 
        basePrice: 20, 
        popularity: 0.35, // 35% of bookings
        peakDays: [0, 6] // Weekends
      },
      { 
        name: 'Breestraat Book Corner', 
        basePrice: 30, 
        popularity: 0.25, // 25% of bookings
        peakDays: [2, 3, 4, 5, 6] // Tuesday to Saturday
      }
    ];

    // Create bookings for the last 90 days (more comprehensive history)
    const totalBookings = 500; // Increased number for better analytics
    
    for (let i = 0; i < totalBookings; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      
      // Select location based on popularity
      const locationRandom = Math.random();
      let selectedLocationData = locationData[0];
      let cumulative = 0;
      
      for (const locData of locationData) {
        cumulative += locData.popularity;
        if (locationRandom <= cumulative) {
          selectedLocationData = locData;
          break;
        }
      }
      
      const location = locations.find(l => l.name === selectedLocationData!.name);
      if (!location) continue;

      // Create booking date (last 90 days with realistic distribution)
      const daysOffset = -Math.floor(Math.random() * 90); // 0 to 89 days ago
      const bookingDate = new Date(now);
      bookingDate.setDate(bookingDate.getDate() + daysOffset);
      
      // Higher booking frequency on peak days
      const dayOfWeek = bookingDate.getDay();
      const isPeakDay = selectedLocationData!.peakDays.includes(dayOfWeek);
      
      // Skip some non-peak days to create realistic patterns
      if (!isPeakDay && Math.random() < 0.3) {
        continue;
      }

      // Business hours: 8 AM to 8 PM with realistic distribution
      const hourWeights = [
        { hour: 8, weight: 0.05 },  // 5% - early morning
        { hour: 9, weight: 0.10 },  // 10% - morning
        { hour: 10, weight: 0.15 }, // 15% - late morning
        { hour: 11, weight: 0.15 }, // 15% - pre-lunch
        { hour: 12, weight: 0.20 }, // 20% - lunch peak
        { hour: 13, weight: 0.15 }, // 15% - afternoon
        { hour: 14, weight: 0.10 }, // 10% - mid-afternoon
        { hour: 15, weight: 0.05 }, // 5% - late afternoon
        { hour: 16, weight: 0.03 }, // 3% - evening
        { hour: 17, weight: 0.02 }  // 2% - late evening
      ];

      const hourRandom = Math.random();
      let startHour = 12;
      let hourCumulative = 0;
      
      for (const { hour, weight } of hourWeights) {
        hourCumulative += weight;
        if (hourRandom <= hourCumulative) {
          startHour = hour;
          break;
        }
      }

      const startMinute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45 minutes
      
      const startTime = new Date(bookingDate);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      // Duration: 1-4 hours with realistic distribution
      const durationWeights = [
        { duration: 1, weight: 0.40 }, // 40% - 1 hour
        { duration: 2, weight: 0.35 }, // 35% - 2 hours
        { duration: 3, weight: 0.20 }, // 20% - 3 hours
        { duration: 4, weight: 0.05 }  // 5% - 4 hours
      ];

      const durationRandom = Math.random();
      let duration = 2;
      let durationCumulative = 0;
      
      for (const { duration: dur, weight } of durationWeights) {
        durationCumulative += weight;
        if (durationRandom <= durationCumulative) {
          duration = dur;
          break;
        }
      }

      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + duration);
      
      // Status based on booking date
      let status: string;
      const daysSinceBooking = Math.abs(daysOffset);
      
      if (daysSinceBooking > 7) {
        // Old bookings - mostly completed or cancelled
        status = Math.random() < 0.85 ? 'COMPLETED' : 'CANCELLED';
      } else if (daysSinceBooking > 1) {
        // Recent bookings - confirmed or completed
        status = Math.random() < 0.70 ? 'COMPLETED' : 'CONFIRMED';
      } else if (daysSinceBooking === 0) {
        // Today's bookings - in progress, confirmed, or pending
        const todayRandom = Math.random();
        if (todayRandom < 0.05) status = 'IN_PROGRESS';
        else if (todayRandom < 0.70) status = 'CONFIRMED';
        else status = 'PENDING';
      } else {
        // Future bookings - confirmed or pending
        status = Math.random() < 0.80 ? 'CONFIRMED' : 'PENDING';
      }

      // Price calculation with realistic variations
      const basePrice = selectedLocationData!.basePrice;
      const seasonalMultiplier = 1 + (Math.sin((bookingDate.getMonth() + 1) * Math.PI / 6) * 0.2); // Seasonal variation
      const weekendMultiplier = isPeakDay ? 1.15 : 1.0; // Weekend premium
      const durationMultiplier = duration > 2 ? 0.95 : 1.0; // Slight discount for longer bookings
      
      const price = Math.round(
        basePrice * duration * seasonalMultiplier * weekendMultiplier * durationMultiplier
      );

      // Creation time should be before booking time
      const creationOffset = Math.floor(Math.random() * 14) + 1; // 1-14 days before
      const createdAt = new Date(startTime);
      createdAt.setDate(createdAt.getDate() - creationOffset);

      allBookings.push({
        _id: new mongoose.Types.ObjectId(),
        userId: customer!._id,
        locationId: location._id,
        startTime,
        endTime,
        status,
        price,
        notes: Math.random() > 0.8 ? `Booking for ${customer!.profile?.name?.split(' ')[0]}` : undefined,
        createdAt,
        updatedAt: new Date(Math.max(createdAt.getTime(), endTime.getTime()))
      });
    }

    // Insert all bookings
    if (allBookings.length > 0) {
      await bookingsCollection.insertMany(allBookings);
      console.log(`Created ${allBookings.length} analytics bookings`);
      
      // Display comprehensive summary
      const statusCounts = statusDistribution.map(({ status }) => ({
        status,
        count: allBookings.filter(b => b.status === status).length
      }));

      const locationCounts = locationData.map(({ name }) => ({
        location: name,
        count: allBookings.filter(b => {
          const loc = locations.find(l => l._id.toString() === b.locationId.toString());
          return loc?.name === name;
        }).length
      }));

      const completedBookings = allBookings.filter(b => b.status === 'COMPLETED');
      const totalRevenue = completedBookings.reduce((sum, b) => sum + b.price, 0);
      const avgBookingValue = completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0;

      // Monthly revenue calculation
      const monthlyRevenue = new Map<string, number>();
      completedBookings.forEach(booking => {
        const month = booking.startTime.toISOString().slice(0, 7); // YYYY-MM
        monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + booking.price);
      });

      console.log('\n📊 Analytics Data Summary:');
      console.log('=========================');
      
      console.log('\n📈 Booking Status Distribution:');
      statusCounts.forEach(({ status, count }) => {
        const percentage = ((count / allBookings.length) * 100).toFixed(1);
        console.log(`  ${status}: ${count} (${percentage}%)`);
      });

      console.log('\n📍 Location Distribution:');
      locationCounts.forEach(({ location, count }) => {
        const percentage = ((count / allBookings.length) * 100).toFixed(1);
        console.log(`  ${location}: ${count} (${percentage}%)`);
      });

      console.log('\n💰 Revenue Metrics:');
      console.log(`  Total Revenue: €${totalRevenue.toLocaleString()}`);
      console.log(`  Average Booking Value: €${avgBookingValue.toFixed(2)}`);
      console.log(`  Total Bookings: ${allBookings.length}`);
      console.log(`  Completed Bookings: ${completedBookings.length}`);

      console.log('\n📅 Monthly Revenue (last 3 months):');
      Array.from(monthlyRevenue.entries())
        .sort()
        .slice(-3)
        .forEach(([month, revenue]) => {
          console.log(`  ${month}: €${revenue.toLocaleString()}`);
        });

      console.log('\n✅ Comprehensive analytics data created!');
      console.log('📊 The dashboard should now show much more realistic data patterns.');
    }
    
  } catch (error) {
    console.error('Error creating analytics data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createAnalyticsData();