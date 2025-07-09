const axios = require('axios');

async function testWidgetBooking() {
  try {
    // First, create a test booking through the widget API
    const bookingData = {
      locationId: '5f9d88b9c26d4e3f8c6d6b4a', // You'll need to use a valid location ID
      serviceId: 'valet',
      guestEmail: 'test@example.com',
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

    const response = await axios.post('http://localhost:3000/api/widget/bookings', bookingData, {
      headers: {
        'x-api-key': 'your-test-api-key', // You'll need to use a valid API key
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:8080'
      }
    });

    console.log('\n✅ Booking created successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\n📧 Check the email logs in the backend console to verify the email was sent.');
    
  } catch (error) {
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