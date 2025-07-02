# Email Provider Options for Vale

This document outlines all available email providers for the Vale booking system, including free and open-source alternatives.

## Quick Start - Free Options

### 1. **Resend** (Primary - Free Tier)
- **Free**: 3,000 emails/month
- **Setup**: 2 minutes
- **Best for**: Getting started quickly

```bash
EMAIL_PROVIDER=resend
RESEND_KEY=re_1234567890abcdef
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Vale Booking System
```

**Get API Key**: [resend.com](https://resend.com) - Sign up and get 3,000 free emails/month

### 2. **Gmail SMTP** (Free)
- **Free**: 500 emails/day
- **Setup**: 5 minutes
- **Best for**: Personal projects, testing

```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Vale Booking System
```

**Setup**: Enable 2FA on Gmail, generate App Password

### 3. **Brevo (Sendinblue)** (Free Tier)
- **Free**: 300 emails/day
- **Setup**: 3 minutes
- **Best for**: Email marketing + transactional

```bash
EMAIL_PROVIDER=sendgrid  # Uses same API format
EMAIL_API_KEY=xkeysib-your-api-key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Vale Booking System
```

**Get API Key**: [brevo.com](https://brevo.com) - 300 free emails/day

## Production Options

### 4. **AWS SES** (Very Cheap)
- **Pricing**: $0.10 per 1,000 emails
- **Best for**: Cost optimization at scale

```bash
EMAIL_PROVIDER=ses
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
EMAIL_REGION=us-east-1
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Vale Booking System
```



### 6. **Custom SMTP Server** (Free)
- **Cost**: Server hosting only
- **Best for**: Full control, unlimited emails

```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Vale Booking System
```

## Self-Hosted Options (Completely Free)

### 7. **Mail-in-a-Box**
- **Cost**: Server hosting only (~$5/month)
- **Features**: Complete email server
- **Setup**: [mailinabox.email](https://mailinabox.email)

### 8. **iRedMail**
- **Cost**: Server hosting only
- **Features**: Open source mail server
- **Setup**: [iredmail.org](https://iredmail.org)

### 9. **Postfix + Dovecot**
- **Cost**: Server hosting only
- **Features**: Linux mail server stack
- **Setup**: Manual configuration

## Provider Comparison

| Provider | Free Tier | Setup Time | Deliverability | Cost at Scale |
|----------|-----------|------------|----------------|---------------|
| **Resend** | 3k/month | 2 min | Excellent | $20/100k |
| **Gmail SMTP** | 500/day | 5 min | Good | N/A |
| **Brevo** | 300/day | 3 min | Good | $25/100k |
| **AWS SES** | 62k/month* | 10 min | Excellent | $0.10/1k |
| **Self-hosted** | Unlimited | 30 min | Variable | Server cost |

*AWS SES free tier: 62,000 emails/month when sent from EC2

## Recommended Setup for Different Scenarios

### **Development/Testing**
```bash
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_test_key
EMAIL_FROM=test@yourdomain.com
```

### **Small Business (< 1k emails/month)**
```bash
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_production_key
EMAIL_FROM=noreply@yourdomain.com
```

### **Medium Business (1k-10k emails/month)**
```bash
EMAIL_PROVIDER=resend
RESEND_KEY=re_production_key
EMAIL_FROM=noreply@yourdomain.com
```

### **Large Business (> 10k emails/month)**
```bash
EMAIL_PROVIDER=ses
AWS_ACCESS_KEY_ID=production_key
AWS_SECRET_ACCESS_KEY=production_secret
EMAIL_FROM=noreply@yourdomain.com
```

### **Enterprise (Full Control)**
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.yourdomain.com
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=secure_password
EMAIL_FROM=noreply@yourdomain.com
```

## Testing Your Setup

After configuring your provider, test it:

```bash
# Test email configuration
curl -X POST http://localhost:3000/api/admin/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

Or use the built-in test function:

```typescript
import { testEmailConfig } from './services/EmailService';

const result = await testEmailConfig();
console.log('Email test result:', result);
```

## Troubleshooting

### Common Issues

1. **"API key required" error**
   - Check `EMAIL_API_KEY` environment variable
   - Verify API key is valid for your provider

2. **"Invalid from address" error**
   - Verify sender domain is verified with provider
   - Check `EMAIL_FROM` format

3. **"Rate limit exceeded" error**
   - Check your provider's rate limits
   - Implement retry logic for bulk emails

### Provider-Specific Issues

**Resend**: Verify domain in Resend dashboard
**SendGrid**: Verify sender authentication
**AWS SES**: Verify domain/email in SES console
**SMTP**: Check firewall/port settings

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables for all credentials**
3. **Rotate API keys regularly**
4. **Monitor email delivery rates**
5. **Implement rate limiting for your API**

## Migration Between Providers

The Vale email service is designed to be provider-agnostic. To switch providers:

1. Update environment variables
2. Test with new provider
3. Monitor delivery rates
4. Update DNS records if needed

No code changes required! 