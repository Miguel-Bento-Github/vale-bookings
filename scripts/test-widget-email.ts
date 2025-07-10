import axios from 'axios';

async function testWidgetBooking(): Promise<void> {
  try {
    // First, create a test booking through the widget API
    const bookingData = {
      locationId: '686f7803c20660671d6dfdaa', // Downtown Parking location ID
      serviceId: 'valet',
      guestEmail: 'delivered@resend.dev',
      guestName: 'Test User',
      guestPhone: '+1234567890',
      bookingDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      bookingTime: '14:00',
      duration: 60,
      gdprConsent: {
        version: '1.0',
        acceptedAt: new Date().toISOString(),
        ipAddress: '127.0.0.1'
      }
    };

    console.log('Creating test booking...');
    console.log('Booking data:', JSON.stringify(bookingData, null, 2));

    const response = await axios.post('http://localhost:3000/api/widget/v1/bookings', bookingData, {
      headers: {
        'x-api-key': '229c6e69beff246d1ec8ac4f5e383fd1f295c78e617a2308241ac436082c0cd0', // Test API key
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:8080'
      }
    });

    console.log('\n✅ Booking created successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\n📧 Check the email logs in the backend console to verify the email was sent.');
    
  } catch (error: any) {
    console.error('\n❌ Error creating booking:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('\n💡 Make sure you have a valid API key for the widget.');
    }
    if (error.response?.status === 404) {
      console.log('\n💡 Make sure the location ID exists in your database.');
    }
  }
}

// Run the test
console.log('🧪 Testing widget booking with email confirmation...\n');
testWidgetBooking(); 