#!/usr/bin/env node

/**
 * Webhook Setup Script for Resend
 * 
 * This script helps you configure webhooks with Resend
 * 
 * Usage:
 *   node scripts/setup-webhooks.js
 */

require('dotenv').config();

// Simple webhook URL generation without requiring compiled code
function getWebhookUrl() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/api/webhooks/email`;
}

function displayWebhookInfo() {
  console.log('🔗 Vale Email Webhook Configuration');
  console.log('====================================');
  console.log('');

  // Get webhook URL
  const webhookUrl = getWebhookUrl();
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  console.log('📋 Webhook Information:');
  console.log(`- Endpoint URL: ${webhookUrl}`);
  console.log(`- Health Check: ${webhookUrl}/health`);
  console.log(`- Base URL: ${baseUrl}`);
  console.log('');

  console.log('📧 Supported Webhook Events:');
  console.log('- email.delivered - Email delivered successfully');
  console.log('- email.delivery_delayed - Email delivery delayed');
  console.log('- email.bounced - Email bounced (hard/soft)');
  console.log('- email.complained - Email marked as spam');
  console.log('- email.unsubscribed - User unsubscribed');
  console.log('');

  console.log('🔧 Configuration Steps:');
  console.log('');
  console.log('1. Go to Resend Dashboard: https://resend.com/webhooks');
  console.log('2. Click "Add Webhook"');
  console.log('3. Enter the following details:');
  console.log(`   - URL: ${webhookUrl}`);
  console.log('   - Events: Select all events (delivered, bounced, complained, etc.)');
  console.log('   - Description: Vale Booking System Email Webhooks');
  console.log('');
  console.log('4. Click "Create Webhook"');
  console.log('');

  console.log('🧪 Testing Your Webhook:');
  console.log('');
  console.log('Test with the test addresses:');
  console.log('  node scripts/test-email-simple.js delivered@resend.dev');
  console.log('  node scripts/test-email-simple.js bounced@resend.dev');
  console.log('  node scripts/test-email-simple.js complained@resend.dev');
  console.log('');
  console.log('Check webhook health:');
  console.log(`  curl ${webhookUrl}/health`);
  console.log('');

  console.log('📊 Monitoring:');
  console.log('- Check Resend Dashboard → Webhooks for delivery status');
  console.log('- Monitor your application logs for webhook events');
  console.log('- Use the health endpoint to verify webhook is accessible');
  console.log('');

  console.log('⚠️  Important Notes:');
  console.log('- Your server must be publicly accessible for webhooks to work');
  console.log('- Use HTTPS in production for security');
  console.log('- Webhooks are sent asynchronously, not in real-time');
  console.log('- Failed webhook deliveries are retried automatically by Resend');
  console.log('');

  if (baseUrl.includes('localhost')) {
    console.log('🚨 Development Mode Detected:');
    console.log('Your webhook URL uses localhost. For testing:');
    console.log('1. Use ngrok: ngrok http 3000');
    console.log('2. Update webhook URL with ngrok URL');
    console.log('3. Or deploy to a public server for production testing');
    console.log('');
  }
}

function checkEnvironment() {
  console.log('🔍 Environment Check:');
  console.log(`- API_BASE_URL: ${process.env.API_BASE_URL || 'http://localhost:3000 (default)'}`);
  console.log(`- RESEND_KEY: ${process.env.RESEND_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`- EMAIL_PROVIDER: ${process.env.EMAIL_PROVIDER || 'resend (default)'}`);
  console.log('');

  if (!process.env.RESEND_KEY) {
    console.log('❌ RESEND_KEY not found!');
    console.log('Please set your Resend API key:');
    console.log('export RESEND_KEY=re_your_api_key_here');
    console.log('');
  }
}

function main() {
  checkEnvironment();
  displayWebhookInfo();
}

// Run the script
main(); 