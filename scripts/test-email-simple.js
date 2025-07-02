#!/usr/bin/env node

/**
 * Simple Email Test Script
 * 
 * Usage:
 *   node scripts/test-email-simple.js
 *   node scripts/test-email-simple.js your-email@example.com
 */

require('dotenv').config();

// Parse command line arguments
const testEmail = process.argv[2] || 'delivered@resend.dev';

async function sendTestEmail() {
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
    // Import Resend directly
    const { Resend } = require('resend');
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
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f8f9fa;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              border-radius: 8px;
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px 40px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
              letter-spacing: -0.5px;
            }
            .header .subtitle {
              margin: 8px 0 0 0;
              font-size: 16px;
              opacity: 0.9;
              font-weight: 400;
            }
            .content {
              padding: 40px;
            }
            .test-info {
              background: #f8f9fa;
              border-left: 4px solid #667eea;
              padding: 20px;
              margin: 20px 0;
              border-radius: 0 6px 6px 0;
            }
            .test-info h3 {
              margin: 0 0 15px 0;
              color: #667eea;
              font-size: 18px;
              font-weight: 600;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-top: 15px;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-size: 12px;
              color: #6c757d;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 600;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 14px;
              color: #333;
              font-weight: 500;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px 40px;
              text-align: center;
              border-top: 1px solid #e9ecef;
            }
            .footer p {
              margin: 0;
              font-size: 12px;
              color: #6c757d;
            }
            .status-badge {
              display: inline-block;
              background: #28a745;
              color: white;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            @media (max-width: 600px) {
              .container {
                margin: 0;
                border-radius: 0;
              }
              .header, .content, .footer {
                padding: 20px;
              }
              .info-grid {
                grid-template-columns: 1fr;
              }
            }
          </style>
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
    console.log('3. Monitor webhook events (if configured)');
    console.log('');
    console.log('💡 Test different scenarios:');
    console.log(`   node scripts/test-email-simple.js delivered@resend.dev`);
    console.log(`   node scripts/test-email-simple.js bounced@resend.dev`);
    console.log(`   node scripts/test-email-simple.js complained@resend.dev`);
    console.log(`   node scripts/test-email-simple.js your-email@example.com`);
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    if (error.statusCode === 429) {
      console.log('');
      console.log('💡 Rate limit hit! Try again in a few seconds.');
    }
    
    if (error.message.includes('Invalid from address')) {
      console.log('');
      console.log('💡 Domain not verified in Resend dashboard.');
      console.log('   Add and verify your domain: https://resend.com/domains');
    }
    
    process.exit(1);
  }
}

// Run the test
sendTestEmail().catch(console.error); 