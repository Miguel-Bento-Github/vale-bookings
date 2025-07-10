import 'dotenv/config';
import mongoose from 'mongoose';
import { GuestBooking } from '../src/models/GuestBooking';
import Location from '../src/models/Location';
import { ApiKey } from '../src/models/ApiKey';
import { DATABASE_CONFIG } from '../src/constants/database';
import { 
  GUEST_BOOKING_STATUSES, 
  GDPR_CONSENT_VERSIONS,
  AUDIT_ACTIONS,
  REFERENCE_NUMBER_CONFIG
} from '../src/constants/widget';

// Function to generate reference number
function generateReferenceNumber(): string {
  const timestamp = Date.now().toString(36);
  const randomChars = Array.from(
    { length: REFERENCE_NUMBER_CONFIG.LENGTH - REFERENCE_NUMBER_CONFIG.PREFIX.length - timestamp.length },
    () => REFERENCE_NUMBER_CONFIG.CHARSET[Math.floor(Math.random() * REFERENCE_NUMBER_CONFIG.CHARSET.length)]
  ).join('');
  
  return REFERENCE_NUMBER_CONFIG.PREFIX + timestamp + randomChars;
}

// Function to generate unique reference number
async function generateUniqueReferenceNumber(): Promise<string> {
  let referenceNumber: string;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    referenceNumber = generateReferenceNumber();
    attempts++;
    
    // Check if reference number already exists
    const existing = await GuestBooking.findOne({ referenceNumber });
    if (!existing) {
      return referenceNumber;
    }
    
    // Small delay to ensure different timestamp
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  } while (attempts < maxAttempts);
  
  throw new Error('Failed to generate unique reference number after maximum attempts');
}

async function createTestGuestBookings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(DATABASE_CONFIG.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get existing test data
    const locations = await Location.find({
      name: { 
        $in: [
          'Pieterskerk Square Cafe',
          'Botanical Gardens Workshop', 
          'Breestraat Book Corner'
        ]
      }
    });

    const apiKeys = await ApiKey.find({ name: 'Test Widget Key' });

    if (locations.length === 0) {
      console.log('No test locations found. Please run createTestLocations.ts first.');
      return;
    }

    if (apiKeys.length === 0) {
      console.log('No test API keys found. Please run createTestApiKey.ts first.');
      return;
    }

    console.log(`Found ${locations.length} locations and ${apiKeys.length} API keys`);

    // Clear existing test guest bookings
    await GuestBooking.deleteMany({});
    console.log('Cleared existing guest bookings');

    // Create test guest bookings
    const guestBookings: Array<{
      referenceNumber: string;
      guestEmail: string;
      guestName: string;
      guestPhone: string;
      locationId: string;
      serviceId: string;
      bookingDate: Date;
      bookingTime: string;
      duration: number;
      price: number;
      currency: string;
      gdprConsent: any;
      marketingConsent: boolean;
      widgetApiKey: string;
      originDomain: string;
      ipAddress: string;
      userAgent: string;
      status: string;
      auditTrail: any[];
    }> = [];
    const now = new Date();
    const apiKey = apiKeys[0];

    // Sample guest data
    const guestData = [
      { name: 'Anna van der Berg', email: 'anna.vanderberg@example.com', phone: '+31612345678' },
      { name: 'Pieter de Vries', email: 'pieter.devries@example.com', phone: '+31623456789' },
      { name: 'Maria Santos', email: 'maria.santos@example.com', phone: '+31634567890' },
      { name: 'Lars Nielsen', email: 'lars.nielsen@example.com', phone: '+31645678901' },
      { name: 'Elena Popov', email: 'elena.popov@example.com', phone: '+31656789012' },
      { name: 'Ahmed Hassan', email: 'ahmed.hassan@example.com', phone: '+31667890123' },
      { name: 'Sophie Dubois', email: 'sophie.dubois@example.com', phone: '+31678901234' },
      { name: 'Carlos Rodriguez', email: 'carlos.rodriguez@example.com', phone: '+31689012345' }
    ];

    // Create guest bookings for the next 30 days
    const createdGuestBookings: any[] = [];
    for (let i = 0; i < 20; i++) {
      const guest = guestData[i % guestData.length];
      const location = locations[i % locations.length];
      
      // Generate unique reference number
      const referenceNumber = await generateUniqueReferenceNumber();
      
      // Create booking for a future date
      const bookingDate = new Date(now);
      bookingDate.setDate(bookingDate.getDate() + Math.floor(Math.random() * 30) + 1);
      
      // Random time between 9 AM and 5 PM
      const startHour = 9 + Math.floor(Math.random() * 8);
      const startMinute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
      const bookingTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
      
      // Random duration (1-4 hours)
      const duration = (1 + Math.floor(Math.random() * 4)) * 60; // in minutes
      
      // Random status
      const statuses = Object.values(GUEST_BOOKING_STATUSES);
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Random price between 15 and 50 euros
      const price = 15 + Math.floor(Math.random() * 36);
      
      // Random service
      const services = ['standard-valet', 'premium-valet'];
      const serviceId = services[Math.floor(Math.random() * services.length)];

      // Create GDPR consent
      const gdprConsent = {
        version: GDPR_CONSENT_VERSIONS.V1_0,
        acceptedAt: new Date(),
        ipAddress: '192.168.1.' + (100 + Math.floor(Math.random() * 155)),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      // Create simple audit trail
      const auditTrail = [
        {
          action: AUDIT_ACTIONS.CREATE,
          timestamp: new Date(),
          ipAddress: gdprConsent.ipAddress,
          userAgent: gdprConsent.userAgent,
          metadata: { source: 'test-seeder' }
        }
      ];

      // Create and save the guest booking immediately
      const guestBooking = new GuestBooking({
        referenceNumber,
        guestEmail: guest.email,
        guestName: guest.name,
        guestPhone: guest.phone,
        locationId: location._id.toString(),
        serviceId,
        bookingDate,
        bookingTime,
        duration,
        price,
        currency: 'EUR',
        gdprConsent,
        marketingConsent: Math.random() > 0.7, // 30% chance of marketing consent
        widgetApiKey: apiKey.keyPrefix,
        originDomain: 'localhost:3000',
        ipAddress: gdprConsent.ipAddress,
        userAgent: gdprConsent.userAgent,
        status,
        auditTrail
      });
      const savedBooking = await guestBooking.save();
      createdGuestBookings.push(savedBooking);
    }
    console.log(`Created ${createdGuestBookings.length} test guest bookings`);

    // Display summary by status
    const statusCounts = createdGuestBookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nGuest booking status summary:');
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  - ${status}: ${count}`);
    }

    // Display some sample guest bookings
    console.log('\nSample guest bookings:');
    const sampleBookings = createdGuestBookings.slice(0, 5);
    for (const booking of sampleBookings) {
      const location = locations.find(l => l._id.toString() === booking.locationId);
      
      console.log(`  - ${booking.guestName} (${booking.guestEmail}) at ${location?.name}`);
      console.log(`    ${booking.bookingDate.toLocaleDateString()} at ${booking.bookingTime} (${booking.duration} min)`);
      console.log(`    Service: ${booking.serviceId}, Price: €${booking.price}, Status: ${booking.status}`);
      console.log('');
    }

    console.log('Test guest bookings created successfully!');
  } catch (error) {
    console.error('Error creating test guest bookings:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createTestGuestBookings(); 