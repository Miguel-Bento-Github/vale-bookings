const mongoose = require('mongoose');

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vale_db';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Import the compiled service and model
    const { generateApiKey } = require('../dist/src/services/WidgetAuthService');
    const { ApiKey } = require('../dist/src/models/ApiKey');

    // Delete existing test key if it exists
    const existing = await ApiKey.findOne({ name: 'Test Widget Key' });
    if (existing) {
      console.log('Deleting existing test API key...');
      await ApiKey.deleteOne({ name: 'Test Widget Key' });
    }

    // Generate a new API key
    const { apiKey, rawKey } = await generateApiKey({
      name: 'Test Widget Key',
      domainWhitelist: ['localhost', '127.0.0.1', 'localhost:5173', 'localhost:3000', 'localhost:9876'],
      allowWildcardSubdomains: true,
      createdBy: 'development-script',
      notes: 'Test API key for widget development'
    });

    console.log('\n=== TEST API KEY CREATED ===');
    console.log('API Key:', rawKey);
    console.log('Key Prefix:', apiKey.keyPrefix);
    console.log('Name:', apiKey.name);
    console.log('Domains:', apiKey.domainWhitelist);
    console.log('Use this key in your widget configuration');
    console.log('=============================\n');
  } catch (error) {
    console.error('Error creating test API key:', error);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
} 