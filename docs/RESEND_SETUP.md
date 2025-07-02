# Resend Email Setup for Vale

## Quick Setup (2 minutes)

### 1. Get Resend API Key
1. Go to [resend.com](https://resend.com)
2. Sign up for free account
3. Get 3,000 free emails/month
4. Copy your API key (starts with `re_`)

### 2. Set Environment Variables
```bash
# Required
RESEND_KEY=re_your_api_key_here

# Optional (defaults shown)
EMAIL_PROVIDER=resend
EMAIL_DOMAIN=valebooking.com
EMAIL_FROM=noreply@valebooking.com
EMAIL_FROM_NAME=Vale Booking System
```

### 3. Verify Domain (Optional but Recommended)
1. Go to Resend Dashboard → Domains
2. Add your domain (e.g., `yourdomain.com`)
3. Add DNS records as instructed
4. Wait for verification (usually 5-10 minutes)

### 4. Testing

**Unit Tests:**
```bash
# Run email service tests
npm test -- __tests__/unit/services/emailService.test.ts

# Run webhook service tests
npm test -- __tests__/unit/services/emailWebhookService.test.ts

# Run all tests
npm test
```

**Manual Testing with Resend's Test Addresses:**
For manual testing, you can use Resend's official test addresses:
- `delivered@resend.dev` - Tests successful delivery
- `bounced@resend.dev` - Tests email rejection (SMTP 550)
- `complained@resend.dev` - Tests spam complaints

These addresses are safe to use and won't damage your domain reputation.

## Usage Examples

### Send a Simple Email
```typescript
import { sendEmail } from './services/EmailService';

const result = await sendEmail({
  to: 'customer@example.com',
  subject: 'Welcome to Vale!',
  html: '<h1>Welcome!</h1><p>Thanks for joining.</p>',
  text: 'Welcome! Thanks for joining.'
});
```

### Send Booking Confirmation
```typescript
import { emailTemplateService } from './services/EmailTemplateService';

const result = await emailTemplateService.sendBookingConfirmation({
  bookingId: 'booking-123',
  reference: 'REF123',
  locationName: 'Downtown Office',
  locationAddress: '123 Main St',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T12:00:00Z',
  duration: 2,
  totalAmount: 50,
  currency: 'USD',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  status: 'confirmed'
});
```

### Send Password Reset
```typescript
const result = await emailTemplateService.sendPasswordReset({
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  resetLink: 'https://yourdomain.com/reset?token=abc123',
  expiryTime: '2024-01-16T10:00:00Z',
  supportEmail: 'support@yourdomain.com'
});
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_KEY` | ✅ Yes | - | Your Resend API key |
| `EMAIL_PROVIDER` | ❌ No | `resend` | Email provider (resend/ses/smtp) |
| `EMAIL_DOMAIN` | ❌ No | `valebooking.com` | Domain for email addresses |
| `EMAIL_FROM` | ❌ No | `noreply@valebooking.com` | From email address |
| `EMAIL_FROM_NAME` | ❌ No | `Vale Booking System` | From name |

## Scaling to AWS SES

When you need to scale beyond 3,000 emails/month:

1. **Keep Resend for development/testing**
2. **Add AWS SES for production**:

```bash
# Development
EMAIL_PROVIDER=resend
RESEND_KEY=re_dev_key
EMAIL_DOMAIN=valebooking.com

# Production
EMAIL_PROVIDER=ses
AWS_ACCESS_KEY_ID=prod_key
AWS_SECRET_ACCESS_KEY=prod_secret
EMAIL_REGION=us-east-1
EMAIL_DOMAIN=valebooking.com
```

## Testing & Webhooks

### Safe Testing
Use Resend's official test addresses for development:
- `delivered@resend.dev` - Tests successful delivery
- `bounced@resend.dev` - Tests email rejection (SMTP 550)
- `complained@resend.dev` - Tests spam complaints

### Webhook Testing
Set up webhooks to handle email events:
1. Go to Resend Dashboard → Webhooks
2. Add your webhook endpoint: `https://yourdomain.com/api/webhooks/email`
3. Test with the test addresses above
4. Handle bounce/complaint events in your app

**Available webhook events:**
- `email.delivered` - Email delivered successfully
- `email.delivery_delayed` - Email delivery delayed
- `email.bounced` - Email bounced (hard/soft)
- `email.complained` - Email marked as spam
- `email.unsubscribed` - User unsubscribed

**Webhook handler included:** `EmailWebhookService` automatically handles all events and manages mailing lists.

## Rate Limiting

### Resend Rate Limits
- **Free tier**: 2 requests per second
- **Paid tiers**: Higher limits available
- **Production**: Consider AWS SES for higher volume

### Handling Rate Limits
The email service automatically handles rate limits with:
- **Retry logic**: Up to 3 attempts with exponential backoff
- **Rate limiting**: Built-in delays between requests
- **Error handling**: Graceful degradation when limits are hit

### For High Volume
```bash
# Switch to AWS SES for higher limits
EMAIL_PROVIDER=ses
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

## Troubleshooting

### "API key required" error
- Check `RESEND_KEY` environment variable
- Verify API key starts with `re_`
- Ensure no extra spaces or quotes

### "rate_limit_exceeded" error
- The email service automatically handles rate limits with retry logic
- Add delays between email sends in production using EmailQueueService
- Consider upgrading Resend plan or switching to AWS SES

### "Invalid from address" error
- Verify domain in Resend dashboard
- Check `EMAIL_FROM` format
- Wait for domain verification

### "Rate limit exceeded" error
- Resend free tier: 3,000 emails/month
- Check usage in Resend dashboard
- Consider upgrading or switching to SES

## Cost Comparison

| Provider | Free Tier | Paid (100k emails) |
|----------|-----------|-------------------|
| **Resend** | 3k/month | $20 |
| **AWS SES** | 62k/month* | $10 |
| **SendGrid** | None | $15 |

*When sent from EC2

## Next Steps

1. ✅ Set up Resend API key
2. ✅ Test configuration
3. 🔄 Verify domain (optional)
4. 🚀 Start sending emails!
5. 📊 Monitor delivery rates
6. 🔄 Scale to AWS SES when needed 