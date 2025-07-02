#!/usr/bin/env node

/**
 * Test Email Script
 * 
 * Usage:
 *   node scripts/test-email.js
 *   node scripts/test-email.js --to=your-email@example.com
 *   node scripts/test-email.js --template=booking
 */

require('dotenv').config();

const { sendEmail } = require('../src/services/EmailService');
const { emailTemplateService } = require('../src/services/EmailTemplateService');
const { emailQueueService } = require('../src/services/EmailQueueService');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    options[key] = value;
  }
});

const testEmail = options.to || 'delivered@resend.dev'; // Safe test address by default
const template = options.template || 'simple';

async function testSimpleEmail() {
  console.log('📧 Testing simple email...');
  
  const result = await sendEmail({
    to: testEmail,
    subject: '🧪 Vale Email Test',
    html: `
      <h1>Vale Booking System - Email Test</h1>
      <p>This is a test email from the Vale booking system.</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p><strong>Provider:</strong> ${process.env.EMAIL_PROVIDER || 'resend'}</p>
      <p><strong>From:</strong> ${process.env.EMAIL_FROM || 'noreply@valebooking.com'}</p>
    `,
    text: `
      Vale Booking System - Email Test
      
      This is a test email from the Vale booking system.
      Time: ${new Date().toISOString()}
      Provider: ${process.env.EMAIL_PROVIDER || 'resend'}
      From: ${process.env.EMAIL_FROM || 'noreply@valebooking.com'}
    `
  });

  console.log('✅ Simple email result:', result);
  return result;
}

async function testBookingTemplate() {
  console.log('📧 Testing booking confirmation template...');
  
  const bookingData = {
    bookingId: 'test-booking-123',
    reference: 'TEST123',
    locationName: 'Test Office',
    locationAddress: '123 Test Street, Test City',
    startTime: '2024-01-15T10:00:00Z',
    endTime: '2024-01-15T12:00:00Z',
    duration: 2,
    totalAmount: 50,
    currency: 'USD',
    customerName: 'Test Customer',
    customerEmail: testEmail,
    status: 'confirmed'
  };

  const result = await emailTemplateService.sendBookingConfirmation(bookingData);
  
  console.log('✅ Booking template result:', result);
  return result;
}

async function testQueue() {
  console.log('📧 Testing email queue...');
  
  const queueId = await emailQueueService.enqueue({
    to: testEmail,
    subject: '🧪 Queued Email Test',
    html: '<h1>This is a queued email test</h1>',
    text: 'This is a queued email test'
  }, { priority: 'high' });

  console.log('✅ Email queued with ID:', queueId);
  console.log('📊 Queue status:', emailQueueService.getStatus());
  
  return queueId;
}

async function testScheduledEmail() {
  console.log('📧 Testing scheduled email...');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const queueId = await emailQueueService.enqueue({
    to: testEmail,
    subject: '🧪 Scheduled Email Test',
    html: '<h1>This is a scheduled email test</h1>',
    text: 'This is a scheduled email test'
  }, { 
    priority: 'normal',
    scheduledFor: tomorrow 
  });

  console.log('✅ Email scheduled with ID:', queueId);
  console.log('📅 Scheduled for:', tomorrow.toISOString());
  console.log('📊 Queue status:', emailQueueService.getStatus());
  
  return queueId;
}

async function main() {
  console.log('🚀 Vale Email Testing Script');
  console.log('============================');
  console.log('');
  
  // Check environment
  console.log('🔧 Environment Check:');
  console.log('- EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'resend (default)');
  console.log('- EMAIL_DOMAIN:', process.env.EMAIL_DOMAIN || 'valebooking.com (default)');
  console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || 'noreply@valebooking.com (default)');
  console.log('- RESEND_KEY:', process.env.RESEND_KEY ? '✅ Set' : '❌ Not set');
  console.log('- Test Email:', testEmail);
  console.log('- Template:', template);
  console.log('');

  if (!process.env.RESEND_KEY) {
    console.log('❌ RESEND_KEY not found!');
    console.log('Please set your Resend API key:');
    console.log('export RESEND_KEY=re_your_api_key_here');
    console.log('');
    console.log('💡 Safe test addresses:');
    console.log('- delivered@resend.dev (successful delivery)');
    console.log('- bounced@resend.dev (will bounce)');
    console.log('- complained@resend.dev (will be marked as spam)');
    process.exit(1);
  }

  try {
    switch (template) {
      case 'booking':
        await testBookingTemplate();
        break;
      case 'queue':
        await testQueue();
        break;
      case 'scheduled':
        await testScheduledEmail();
        break;
      case 'all':
        console.log('🧪 Running all tests...\n');
        await testSimpleEmail();
        console.log('');
        await testBookingTemplate();
        console.log('');
        await testQueue();
        console.log('');
        await testScheduledEmail();
        break;
      default:
        await testSimpleEmail();
    }

    console.log('');
    console.log('✅ Testing completed!');
    console.log('');
    console.log('📊 Next steps:');
    console.log('1. Check your Resend dashboard: https://resend.com/emails');
    console.log('2. Check your email inbox (if using real email)');
    console.log('3. Monitor webhook events (if configured)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error); 