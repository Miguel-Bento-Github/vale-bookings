# Valet Backend API

A comprehensive backend API for a valet booking platform built with Node.js, TypeScript, and MongoDB.

## 🚀 Features

- **User Management**: Registration, authentication, and profile management
- **Location Management**: CRUD operations for parking locations with geospatial queries
- **Booking System**: Complete booking lifecycle with overlap detection
- **Schedule Management**: Operating hours management for locations
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Comprehensive Testing**: 66 tests with TDD approach
- **Type Safety**: Full TypeScript implementation
- **Data Validation**: Mongoose schema validation with custom validators

## 📋 Prerequisites

- Node.js 18+
- MongoDB (local or Docker)
- npm or yarn

## 🛠️ Installation

```bash
# Clone the repository
git clone <repository-url>
cd valet-backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start MongoDB (if using Docker)
docker run --name valet-mongo -p 27017:27017 -d mongo:latest

# Run tests
npm test

# Start development server
npm run dev
```

## 📁 Project Structure

```
valet-backend/
├── src/
│   ├── controllers/     # Request handlers (to be implemented)
│   ├── models/         # Mongoose models
│   ├── routes/         # Express routes (to be implemented)
│   ├── services/       # Business logic layer
│   ├── middleware/     # Custom middleware (to be implemented)
│   ├── config/         # Configuration files (to be implemented)
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions (to be implemented)
├── __tests__/
│   ├── unit/           # Unit tests for models and services
│   ├── integration/    # Integration tests (to be implemented)
│   └── fixtures/       # Test data
└── docs/               # Documentation
```

## 🗄️ Database Models

### User
- Email/password authentication
- Role-based access (CUSTOMER, VALET, ADMIN)
- Profile information
- Password hashing with bcrypt

### Location
- Name and address
- GPS coordinates with geospatial indexing
- Active/inactive status
- Text search capabilities

### Booking
- User and location references
- Start/end time validation
- Status tracking (PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED)
- Overlap detection
- Price management

### Schedule
- Location operating hours
- Day of week (0-6)
- Time format validation (HH:MM)
- Unique constraints per location/day

## 🔧 Services

### UserService
- User CRUD operations
- Profile management
- Role management

### AuthService
- User registration and login
- JWT token generation and validation
- Token refresh functionality

### LocationService
- Location CRUD operations
- Geospatial queries (nearby locations)
- Search functionality

### BookingService
- Booking lifecycle management
- Overlap detection
- Status updates
- User and location booking queries

### ScheduleService
- Schedule CRUD operations
- Operating hours validation
- Location availability checks

## 🧪 Testing

The project follows Test-Driven Development (TDD) with comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test __tests__/unit/models.test.ts
```

### Test Coverage
- **66 tests** covering models and services
- **Models**: 36 tests covering validation, relationships, and methods
- **Services**: 30 tests covering business logic and error handling

## 🔐 Environment Variables

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/valet_db
MONGODB_TEST_URI=mongodb://localhost:27017/valet_test_db
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=http://localhost:3000
```

## 📊 API Endpoints (To Be Implemented)

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh tokens
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Locations
- `GET /api/locations` - Get all locations
- `GET /api/locations/:id` - Get location by ID
- `POST /api/locations` - Create location (admin only)
- `PUT /api/locations/:id` - Update location (admin only)
- `DELETE /api/locations/:id` - Delete location (admin only)

### Bookings
- `GET /api/bookings` - Get user bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Get booking by ID
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

### Schedules
- `GET /api/schedules/location/:locationId` - Get location schedules
- `POST /api/schedules` - Create schedule (admin only)
- `PUT /api/schedules/:id` - Update schedule (admin only)
- `DELETE /api/schedules/:id` - Delete schedule (admin only)

## 🚧 Next Steps

1. **Controllers & Routes**: Implement Express controllers and route handlers
2. **Middleware**: Add authentication, authorization, and validation middleware
3. **Integration Tests**: Add API endpoint testing with supertest
4. **Error Handling**: Implement global error handling middleware
5. **Logging**: Add structured logging with Winston
6. **Documentation**: Generate API documentation with Swagger
7. **Deployment**: Add Docker configuration and deployment scripts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Implement the feature
5. Ensure all tests pass
6. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details 