import request from 'supertest'
import app from '../../src/index'
import '../setup'
import { generateTokens } from '../../src/services/AuthService'
import { UserRole } from '../../src/types'

// Helper function to generate access token
const generateAccessToken = (user: { _id: string; email: string; role: UserRole }): string => {
    const tokens = generateTokens({
        _id: user._id,
        email: user.email,
        role: user.role
    } as any)
    return tokens.accessToken
}

describe('Location Controller - Phase 3 Integration Tests', () => {
    let adminToken: string

    beforeAll(() => {
        // Generate admin token for creating test locations
        adminToken = generateAccessToken({
            _id: '507f1f77bcf86cd799439011',
            email: 'admin@example.com',
            role: 'ADMIN' as UserRole
        })
    })

    describe('GET /api/locations/nearby', () => {
        it('should return nearby locations with valid coordinates', async () => {
            const response = await request(app)
                .get('/api/locations/nearby?lat=40.7128&lng=-74.0060&radius=5')
                .expect(200)

            expect(response.body).toHaveProperty('success', true)
            expect(response.body).toHaveProperty('data')
            expect(Array.isArray(response.body.data)).toBe(true)
        })

        it('should validate coordinate parameters', async () => {
            await request(app)
                .get('/api/locations/nearby?lat=invalid&lng=-74.0060')
                .expect(400)
        })

        it('should require latitude and longitude', async () => {
            await request(app)
                .get('/api/locations/nearby?lat=40.7128')
                .expect(400)
        })

        it('should use default radius when not specified', async () => {
            const response = await request(app)
                .get('/api/locations/nearby?lat=40.7128&lng=-74.0060')
                .expect(200)

            expect(response.body.success).toBe(true)
        })

        it('should validate radius parameter', async () => {
            await request(app)
                .get('/api/locations/nearby?lat=40.7128&lng=-74.0060&radius=-5')
                .expect(400)
        })
    })

    describe('GET /api/locations/search', () => {
        it('should search locations by query', async () => {
            const response = await request(app)
                .get('/api/locations/search?q=parking&lat=40.7128&lng=-74.0060')
                .expect(200)

            expect(response.body).toHaveProperty('success', true)
            expect(response.body).toHaveProperty('data')
            expect(Array.isArray(response.body.data)).toBe(true)
        })

        it('should require search query', async () => {
            await request(app)
                .get('/api/locations/search?lat=40.7128&lng=-74.0060')
                .expect(400)
        })

        it('should handle empty search results', async () => {
            const response = await request(app)
                .get('/api/locations/search?q=nonexistent&lat=40.7128&lng=-74.0060')
                .expect(200)

            expect(response.body.data).toEqual([])
        })
    })

    describe('GET /api/locations/:id/availability', () => {
        it('should return availability for valid location', async () => {
            // First create a location for testing
            const locationResponse = await request(app)
                .post('/api/locations')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                })
                .expect(201)

            const locationId = locationResponse.body.data._id
            const testDate = new Date().toISOString().split('T')[0] // Today's date

            const response = await request(app)
                .get(`/api/locations/${locationId}/availability?date=${testDate}`)
                .expect(200)

            expect(response.body).toHaveProperty('success', true)
            expect(response.body.data).toHaveProperty('total')
            expect(response.body.data).toHaveProperty('available')
        })

        it('should validate date parameter', async () => {
            await request(app)
                .get('/api/locations/123456789012345678901234/availability?date=invalid-date')
                .expect(400)
        })

        it('should handle non-existent location', async () => {
            await request(app)
                .get('/api/locations/123456789012345678901234/availability?date=2024-12-01')
                .expect(404)
        })
    })

    describe('GET /api/locations/:id/timeslots', () => {
        it('should return time slots for valid location and date', async () => {
            // First create a location for testing
            const locationResponse = await request(app)
                .post('/api/locations')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Test Location with Hours',
                    address: '456 Test Ave',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                })
                .expect(201)

            const locationId = locationResponse.body.data._id
            const testDate = new Date().toISOString().split('T')[0]

            const response = await request(app)
                .get(`/api/locations/${locationId}/timeslots?date=${testDate}`)
                .expect(200)

            expect(response.body).toHaveProperty('success', true)
            expect(Array.isArray(response.body.data)).toBe(true)

            if (response.body.data.length > 0) {
                expect(response.body.data[0]).toHaveProperty('startTime')
                expect(response.body.data[0]).toHaveProperty('endTime')
                expect(response.body.data[0]).toHaveProperty('available')
            }
        })

        it('should require date parameter', async () => {
            await request(app)
                .get('/api/locations/123456789012345678901234/timeslots')
                .expect(400)
        })

        it('should handle non-existent location', async () => {
            await request(app)
                .get('/api/locations/123456789012345678901234/timeslots?date=2024-12-01')
                .expect(404)
        })
    })

    describe('GET /api/locations/:id/realtime-availability', () => {
        it('should return real-time availability', async () => {
            // First create a location for testing
            const locationResponse = await request(app)
                .post('/api/locations')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Real-time Test Location',
                    address: '789 Test Blvd',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                })
                .expect(201)

            const locationId = locationResponse.body.data._id

            const response = await request(app)
                .get(`/api/locations/${locationId}/realtime-availability`)
                .expect(200)

            expect(response.body).toHaveProperty('success', true)
            expect(response.body.data).toHaveProperty('total')
            expect(response.body.data).toHaveProperty('available')
            expect(response.body.data).toHaveProperty('lastUpdated')
            expect(typeof response.body.data.available).toBe('number')
        })

        it('should handle non-existent location', async () => {
            await request(app)
                .get('/api/locations/123456789012345678901234/realtime-availability')
                .expect(404)
        })
    })

    describe('Error handling', () => {
        it('should handle database connection errors gracefully', async () => {
            // This test might need to mock database failures
            // For now, just ensure the endpoint exists and returns proper error format
            const response = await request(app)
                .get('/api/locations/invalid-id/availability?date=2024-12-01')
                .expect(400)

            expect(response.body).toHaveProperty('success', false)
            expect(response.body).toHaveProperty('message')
        })

        it('should validate ObjectId format for location endpoints', async () => {
            await request(app)
                .get('/api/locations/invalid-id/availability?date=2024-12-01')
                .expect(400)
        })
    })
}) 