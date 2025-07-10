#!/usr/bin/env node

/**
 * Simple Email Test Script
 * 
 * Usage:
 *   npx tsx scripts/test-email-simple.ts
 *   npx tsx scripts/test-email-simple.ts your-email@example.com
 */

import { config } from 'dotenv';
import { Resend } from 'resend';

config();

// Parse command line arguments
const testEmail = process.argv[2] || 'delivered@resend.dev';

async function sendTestEmail(): Promise<void> {
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
    const resend = new Resend(process.env.RESEND_KEY);
    
    const fromEmail = process.env.EMAIL_FROM || `noreply@${process.env.EMAIL_DOMAIN || 'valebooking.com'}`;
    const fromName = process.env.EMAIL_FROM_NAME || 'Vale Booking System';

    console.log('📧 Sending test email...');
    console.log(`From: ${fromName} <${fromEmail}>`);
    console.log(`To: ${testEmail}`);
    console.log('');

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: testEmail,
      subject: '🧪 Vale Email Test',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vale Email Test</title>
          <style>/* ... styles omitted for brevity ... */</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🧪 Vale Email Test</h1>
              <p class="subtitle">Email System Verification</p>
            </div>
            <div class="content">
              <p>This is a test email from the <strong>Vale Booking System</strong> to verify that our email service is configured correctly and functioning properly.</p>
              <div class="test-info">
                <h3>📊 Test Configuration</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">Provider</span>
                    <span class="info-value">${process.env.EMAIL_PROVIDER || 'resend'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Domain</span>
                    <span class="info-value">${process.env.EMAIL_DOMAIN || 'valebooking.com'}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">From Address</span>
                    <span class="info-value">${fromEmail}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Timestamp</span>
                    <span class="info-value">${new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <p>If you received this email, it means our email service is working correctly and ready to send booking confirmations, reminders, and other important communications to our customers.</p>
              <div style="text-align: center; margin: 30px 0;">
                <span class="status-badge">✅ Test Successful</span>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated test email from the Vale Booking System</p>
              <p>© 2024 Vale Booking System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Vale Booking System - Email Test
================================

This is a test email from the Vale Booking System to verify that our email service is configured correctly and functioning properly.

Test Configuration:
- Provider: ${process.env.EMAIL_PROVIDER || 'resend'}
- Domain: ${process.env.EMAIL_DOMAIN || 'valebooking.com'}
- From Address: ${fromEmail}
- Timestamp: ${new Date().toLocaleString()}

If you received this email, it means our email service is working correctly and ready to send booking confirmations, reminders, and other important communications to our customers.

Status: ✅ Test Successful

---
This is an automated test email from the Vale Booking System
© 2024 Vale Booking System. All rights reserved.
      `
    });

    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', result.data?.id || 'N/A');
    console.log('');
    console.log('📊 Next steps:');
    console.log('1. Check your Resend dashboard: https://resend.com/emails');
    console.log('2. Check your email inbox (if using real email)');
    console.log('3. Try sending to bounced@resend.dev or complained@resend.dev for bounce/spam simulation');
    console.log('');
    console.log('💡 You can also test webhooks if configured.');
  } catch (error: any) {
    console.log('❌ Failed to send test email');
    console.log('Error:', error.message);
    if (error.response?.data) {
      console.log('Response:', error.response.data);
    }
  }
}

// Run the test
sendTestEmail().catch(console.error); 