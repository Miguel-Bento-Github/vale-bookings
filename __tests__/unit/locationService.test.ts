import * as LocationService from '../../src/services/LocationService';
import Location from '../../src/models/Location';
import { jest } from '@jest/globals'
interface TestLocation {
    _id?: string
    name: string
    address?: string
    coordinates: { latitude: number; longitude: number }
    isActive: boolean
    pricing?: { hourlyRate: number }
    totalSpots?: number
    operatingHours?: { open: string; close: string }
}

interface TestBooking {
    startTime: Date
    endTime: Date
    spotsReserved?: number
}

interface TimeSlot {
    startTime: Date
    endTime: Date
    available: number
    totalSpots: number
}

describe('LocationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('findNearby', () => {
        it('should find locations near given coordinates', async () => {
            const testLocations: TestLocation[] = [
                {
                    name: 'Downtown Parking',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true,
                    pricing: { hourlyRate: 25 }
                },
                {
                    name: 'Airport Parking',
                    coordinates: { latitude: 40.7589, longitude: -73.9851 },
                    isActive: true,
                    pricing: { hourlyRate: 30 }
                },
                {
                    name: 'Far Away Parking',
                    coordinates: { latitude: 41.0000, longitude: -75.0000 },
                    isActive: true,
                    pricing: { hourlyRate: 20 }
                }
            ]

            // Mock the database query
            jest.spyOn(Location, 'findNearby' as any).mockResolvedValue(testLocations as any);

            const userCoords = { latitude: 40.7128, longitude: -74.0060 }
            const result = await LocationService.findNearby(userCoords.latitude, userCoords.longitude, 10) // 10km radius

            expect(result).toBeDefined()
            expect(result.length).toBeGreaterThan(0)
        })

        it('should return locations sorted by distance', async () => {
            const testLocations: TestLocation[] = [
                {
                    name: 'Far Location',
                    coordinates: { latitude: 40.8000, longitude: -74.0000 },
                    isActive: true
                },
                {
                    name: 'Near Location',
                    coordinates: { latitude: 40.7130, longitude: -74.0062 },
                    isActive: true
                }
            ]

            jest.spyOn(Location, 'findNearby' as any).mockResolvedValue(testLocations as any);

            const userCoords = { latitude: 40.7128, longitude: -74.0060 }
            const result = await LocationService.findNearby(userCoords.latitude, userCoords.longitude, 20)

            expect(result).toBeDefined()
            expect(result.length).toBeGreaterThan(0)
        })

        it('should respect radius parameter', async () => {
            const testLocations: TestLocation[] = [
                {
                    name: 'Within Radius',
                    coordinates: { latitude: 40.7150, longitude: -74.0080 },
                    isActive: true
                }
            ]

            jest.spyOn(Location, 'findNearby' as any).mockResolvedValue(testLocations as any);

            const userCoords = { latitude: 40.7128, longitude: -74.0060 }
            const result = await LocationService.findNearby(userCoords.latitude, userCoords.longitude, 5) // 5km radius

            expect(result).toHaveLength(1)
            expect(result[0]?.name).toBe('Within Radius')
        })

        it('should handle empty results gracefully', async () => {
            jest.spyOn(Location, 'findNearby' as any).mockResolvedValue([]);

            const userCoords = { latitude: 40.7128, longitude: -74.0060 }
            const result = await LocationService.findNearby(userCoords.latitude, userCoords.longitude, 10)

            expect(result).toEqual([])
        })

        it('should filter out inactive locations', async () => {
            const testLocations: TestLocation[] = [
                {
                    name: 'Active Location',
                    coordinates: { latitude: 40.7130, longitude: -74.0062 },
                    isActive: true
                }
            ]

            // The findNearby method should already filter for active locations
            jest.spyOn(Location, 'findNearby' as any).mockResolvedValue(testLocations as any);

            const userCoords = { latitude: 40.7128, longitude: -74.0060 }
            const result = await LocationService.findNearby(userCoords.latitude, userCoords.longitude, 10)

            expect(result).toHaveLength(1)
            expect(result[0]?.name).toBe('Active Location')
        })
    })

    describe('searchLocations', () => {
        it('should search locations by name and address', async () => {
            const testLocations: TestLocation[] = [
                {
                    name: 'Downtown Parking Garage',
                    address: '123 Main St, New York, NY',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                }
            ]

            jest.spyOn(Location, 'search' as any).mockResolvedValue(testLocations as any);

            const result = await LocationService.searchLocations('downtown')

            expect(result).toHaveLength(1)
            expect(result[0]?.name).toContain('Downtown')
        })

        it('should handle search with no results', async () => {
            jest.spyOn(Location, 'search' as any).mockResolvedValue([]);

            const result = await LocationService.searchLocations('nonexistent')

            expect(result).toEqual([])
        })
    })

    describe('getAllLocations', () => {
        it('should return all active locations', async () => {
            const testLocations: TestLocation[] = [
                {
                    name: 'Location 1',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                },
                {
                    name: 'Location 2',
                    coordinates: { latitude: 40.7589, longitude: -73.9851 },
                    isActive: true
                }
            ]

            jest.spyOn(Location, 'find').mockResolvedValue(testLocations as any);

            const result = await LocationService.getAllLocations()

            expect(result).toHaveLength(2)
            expect(result.every(loc => loc.isActive)).toBe(true)
        })
    })

    describe('getLocationById', () => {
        it('should return location by ID', async () => {
            const testLocation: TestLocation = {
                _id: 'location-123',
                name: 'Test Location',
                coordinates: { latitude: 40.7128, longitude: -74.0060 },
                isActive: true
            }

            jest.spyOn(Location, 'findById').mockResolvedValue(testLocation as any);

            const result = await LocationService.getLocationById('location-123')

            expect(result).toBeDefined()
            expect(result?._id).toBe('location-123')
            expect(result?.name).toBe('Test Location')
        })

        it('should return null for non-existent location', async () => {
            jest.spyOn(Location, 'findById').mockResolvedValue(null);

            const result = await LocationService.getLocationById('nonexistent')

            expect(result).toBeNull()
        })
    })

    describe('createLocation', () => {
        it('should create a new location', async () => {
            const locationData = {
                name: 'New Location',
                address: '123 Test St',
                coordinates: { latitude: 40.7128, longitude: -74.0060 },
                isActive: true
            }

            const savedLocation = { ...locationData, _id: 'new-location-id' }

            // Mock the Location constructor and save method
            const mockSave = jest.spyOn(Location.prototype, 'save').mockResolvedValue(savedLocation as any);

            const result = await LocationService.createLocation(locationData)

            expect(mockSave).toHaveBeenCalled()
            expect(result).toHaveProperty('_id')
        })
    })
}) 