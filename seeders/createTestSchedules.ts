import mongoose from 'mongoose';
import Schedule from '../src/models/Schedule';
import Location from '../src/models/Location';
import { DATABASE_CONFIG } from '../src/constants/database';

async function createTestSchedules() {
  try {
    // Connect to MongoDB
    await mongoose.connect(DATABASE_CONFIG.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get existing test locations
    const locations = await Location.find({
      name: { 
        $in: [
          'Pieterskerk Square Cafe',
          'Botanical Gardens Workshop', 
          'Breestraat Book Corner'
        ]
      }
    });

    if (locations.length === 0) {
      console.log('No test locations found. Please run createTestLocations.ts first.');
      return;
    }

    console.log(`Found ${locations.length} test locations`);

    // Clear existing schedules for these locations
    const locationIds = locations.map(loc => loc._id);
    await Schedule.deleteMany({ locationId: { $in: locationIds } });
    console.log('Cleared existing schedules for test locations');

    // Create schedules for each location
    const schedules: Array<{
      locationId: mongoose.Types.ObjectId;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isActive: boolean;
    }> = [];

    for (const location of locations) {
      // Different schedules based on location type
      let weeklySchedule;
      
      if (location.name === 'Pieterskerk Square Cafe') {
        // Cafe - longer hours, closed on Sunday
        weeklySchedule = [
          { dayOfWeek: 1, startTime: '08:00', endTime: '18:00' }, // Monday
          { dayOfWeek: 2, startTime: '08:00', endTime: '18:00' }, // Tuesday
          { dayOfWeek: 3, startTime: '08:00', endTime: '18:00' }, // Wednesday
          { dayOfWeek: 4, startTime: '08:00', endTime: '18:00' }, // Thursday
          { dayOfWeek: 5, startTime: '08:00', endTime: '20:00' }, // Friday
          { dayOfWeek: 6, startTime: '09:00', endTime: '20:00' }, // Saturday
        ];
      } else if (location.name === 'Botanical Gardens Workshop') {
        // Workshop - standard business hours
        weeklySchedule = [
          { dayOfWeek: 1, startTime: '10:00', endTime: '17:00' }, // Monday
          { dayOfWeek: 2, startTime: '10:00', endTime: '17:00' }, // Tuesday
          { dayOfWeek: 3, startTime: '10:00', endTime: '17:00' }, // Wednesday
          { dayOfWeek: 4, startTime: '10:00', endTime: '17:00' }, // Thursday
          { dayOfWeek: 5, startTime: '10:00', endTime: '17:00' }, // Friday
          { dayOfWeek: 6, startTime: '10:00', endTime: '17:00' }, // Saturday
          { dayOfWeek: 0, startTime: '10:00', endTime: '17:00' }, // Sunday
        ];
      } else {
        // Book Corner - retail hours
        weeklySchedule = [
          { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }, // Monday
          { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' }, // Tuesday
          { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' }, // Wednesday
          { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' }, // Thursday
          { dayOfWeek: 5, startTime: '09:00', endTime: '19:00' }, // Friday
          { dayOfWeek: 6, startTime: '10:00', endTime: '19:00' }, // Saturday
          { dayOfWeek: 0, startTime: '12:00', endTime: '17:00' }, // Sunday
        ];
      }

      // Create schedule entries for this location
      for (const schedule of weeklySchedule) {
        schedules.push({
          locationId: location._id,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isActive: true
        });
      }
    }

    // Insert all schedules
    const createdSchedules = await Schedule.insertMany(schedules);
    console.log(`Created ${createdSchedules.length} test schedules:`);
    
    // Group by location for display
    const schedulesByLocation = createdSchedules.reduce((acc, schedule) => {
      const location = locations.find(loc => loc._id.toString() === schedule.locationId.toString());
      const locationName = location?.name || 'Unknown';
      
      if (!acc[locationName]) {
        acc[locationName] = [];
      }
      acc[locationName].push(schedule);
      return acc;
    }, {} as Record<string, any[]>);

    // Display schedules by location
    for (const [locationName, locationSchedules] of Object.entries(schedulesByLocation)) {
      console.log(`\n${locationName}:`);
      locationSchedules.forEach(schedule => {
        const dayName = Schedule.getDayName(schedule.dayOfWeek);
        console.log(`  - ${dayName}: ${schedule.startTime} - ${schedule.endTime}`);
      });
    }

    console.log('\nTest schedules created successfully!');
  } catch (error) {
    console.error('Error creating test schedules:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createTestSchedules(); 