// Test email service using Resend's official test addresses
import { config } from 'dotenv';
import { Resend } from 'resend';

config();

async function testResendEmails(): Promise<void> {
  console.log('=== Resend Email Testing ===');
  console.log('Using official Resend test addresses for safe testing');
  console.log('');

  if (!process.env.RESEND_KEY) {
    console.log('❌ RESEND_KEY not found');
    console.log('Please set: export RESEND_KEY=re_your_api_key_here');
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_KEY);
  const fromEmail = process.env.EMAIL_FROM || 'noreply@vale.com';
  const fromName = process.env.EMAIL_FROM_NAME || 'Vale Booking System';

  console.log('✅ Environment configured');
  console.log(`📧 From: ${fromName} <${fromEmail}>`);
  console.log('');

  // Test 1: Successful delivery
  console.log('🧪 Test 1: Successful delivery');
  try {
    const result1 = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: 'delivered@resend.dev',
      subject: '✅ Vale Booking - Test Delivery',
      html: `
        <h1>Vale Booking System</h1>
        <p>This is a test email for successful delivery.</p>
        <p><strong>Test:</strong> Email should be delivered normally</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      text: `
        Vale Booking System
        
        This is a test email for successful delivery.
        Test: Email should be delivered normally
        Time: ${new Date().toISOString()}
      `
    });
    console.log('✅ Sent to delivered@resend.dev');
    console.log(`   Message ID: ${result1.data?.id}`);
  } catch (error: any) {
    console.log('❌ Failed to send to delivered@resend.dev');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');

  // Test 2: Bounced email
  console.log('🧪 Test 2: Bounced email (simulates rejection)');
  try {
    const result2 = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: 'bounced@resend.dev',
      subject: '❌ Vale Booking - Test Bounce',
      html: `
        <h1>Vale Booking System</h1>
        <p>This is a test email that will bounce.</p>
        <p><strong>Test:</strong> Email should be rejected (SMTP 550)</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      text: `
        Vale Booking System
        
        This is a test email that will bounce.
        Test: Email should be rejected (SMTP 550)
        Time: ${new Date().toISOString()}
      `
    });
    console.log('✅ Sent to bounced@resend.dev (will bounce)');
    console.log(`   Message ID: ${result2.data?.id}`);
  } catch (error: any) {
    console.log('❌ Failed to send to bounced@resend.dev');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');

  // Test 3: Spam complaint
  console.log('🧪 Test 3: Spam complaint (simulates marked as spam)');
  try {
    const result3 = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: 'complained@resend.dev',
      subject: '🚫 Vale Booking - Test Spam',
      html: `
        <h1>Vale Booking System</h1>
        <p>This is a test email that will be marked as spam.</p>
        <p><strong>Test:</strong> Email should be marked as spam</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      text: `
        Vale Booking System
        
        This is a test email that will be marked as spam.
        Test: Email should be marked as spam
        Time: ${new Date().toISOString()}
      `
    });
    console.log('✅ Sent to complained@resend.dev (will be marked as spam)');
    console.log(`   Message ID: ${result3.data?.id}`);
  } catch (error: any) {
    console.log('❌ Failed to send to complained@resend.dev');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');
  console.log('=== Test Results ===');
  console.log('📊 Check your Resend dashboard for:');
  console.log('   - Delivery status');
  console.log('   - Bounce events');
  console.log('   - Spam complaints');
  console.log('   - Webhook events (if configured)');
  console.log('');
  console.log('🔗 Dashboard: https://resend.com/emails');
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Set up webhooks to handle bounce/complaint events');
  console.log('   2. Test with your actual domain');
  console.log('   3. Monitor deliverability metrics');
}

// Run the test
testResendEmails().catch(console.error); 