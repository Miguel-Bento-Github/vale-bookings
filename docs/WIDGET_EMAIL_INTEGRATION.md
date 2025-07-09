# Widget Email Integration

## Overview

The Vale booking widget now sends automatic confirmation emails when a booking is successfully created. This integration uses the existing email infrastructure in the backend.

## How It Works

1. When a booking is created through the widget API (`POST /api/widget/bookings`), the system:
   - Creates the guest booking in the database
   - Sends a confirmation email to the guest's email address
   - Logs the email status (success or failure)

2. Email sending is non-blocking - if the email fails, the booking is still created successfully.

## Email Template

The confirmation email includes:
- Booking reference number
- Location name and address
- Date and time of the booking
- Duration
- Total amount and currency
- Booking status
- Default instructions and cancellation policy

## Configuration

### Email Provider Setup

The backend supports two email providers:
- **SMTP**: Configure with environment variables
- **Resend**: Configure with API key

Set these environment variables in your `.env` file:

```bash
# For Resend (recommended)
EMAIL_PROVIDER=resend
RESEND_KEY=your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Vale Booking System

# For SMTP
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_SECURE=false
EMAIL_FROM=your_email@gmail.com
EMAIL_FROM_NAME=Vale Booking System
```

### Testing Email Functionality

1. **Create a test API key** (if you don't have one):
   ```bash
   cd backend
   node scripts/createTestApiKey.js
   ```

2. **Create a test location** (if you don't have one):
   ```bash
   node scripts/createTestLocations.ts
   ```

3. **Test widget booking with email**:
   ```bash
   node test-widget-email.js
   ```

## Email Content Customization

To customize the email content, modify the email template in `backend/src/controllers/WidgetController.ts`:

```javascript
const emailData = {
  // ... other fields
  instructions: 'Please arrive 5 minutes before your scheduled time.',
  cancellationPolicy: 'You can cancel up to 2 hours before your booking time.'
};
```

For more advanced customization, update the templates in `backend/src/services/EmailTemplateService.ts`.

## Monitoring

Email sending is logged in the backend console:
- Success: `"Booking confirmation email sent"`
- Failure: `"Failed to send booking confirmation email"` with error details

Check the backend logs to monitor email delivery status.

## Troubleshooting

1. **Emails not sending**: 
   - Check your email provider configuration in `.env`
   - Verify API keys/SMTP credentials are correct
   - Check backend logs for specific error messages

2. **Invalid email addresses**:
   - The system validates email format before sending
   - Check that guest emails are properly formatted

3. **Rate limiting**:
   - Resend has built-in retry logic for rate limits
   - SMTP uses connection pooling to manage throughput 