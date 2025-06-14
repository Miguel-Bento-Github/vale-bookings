import mongoose from 'mongoose';
import AdminService from '../../src/services/AdminService';
import User from '../../src/models/User';
import Location from '../../src/models/Location';
import Booking from '../../src/models/Booking';
import Schedule from '../../src/models/Schedule';
import { AppError } from '../../src/types';
import bcrypt from 'bcryptjs';

describe('AdminService', () => {
    describe('User Management', () => {
        describe('getAllUsers', () => {
            it('should return paginated users with default pagination', async () => {
                // Create test users
                const users = await Promise.all([
                    User.create({
                        email: 'user1@example.com',
                        password: await bcrypt.hash('password123', 10),
                        role: 'CUSTOMER',
                        profile: { name: 'User 1' }
                    }),
                    User.create({
                        email: 'user2@example.com',
                        password: await bcrypt.hash('password123', 10),
                        role: 'VALET',
                        profile: { name: 'User 2' }
                    })
                ]);

                const result = await AdminService.getAllUsers({});

                expect(result.users).toHaveLength(2);
                expect(result.pagination.currentPage).toBe(1);
                expect(result.pagination.totalPages).toBe(1);
                expect(result.pagination.totalItems).toBe(2);
                expect(result.pagination.itemsPerPage).toBe(10);
                // Check that password is not included in the response
                expect(result.users[0]).toHaveProperty('email');
                expect(result.users[0]).toHaveProperty('role');
                expect(result.users[0]).toHaveProperty('profile');
            });

            it('should handle custom pagination parameters', async () => {
                // Create 15 test users
                const userPromises = Array.from({ length: 15 }, async (_, i) =>
                    User.create({
                        email: `user${i + 1}@example.com`,
                        password: await bcrypt.hash('password123', 10),
                        role: 'CUSTOMER',
                        profile: { name: `User ${i + 1}` }
                    })
                );
                await Promise.all(userPromises);

                const result = await AdminService.getAllUsers({ page: 2, limit: 5 });

                expect(result.users).toHaveLength(5);
                expect(result.pagination.currentPage).toBe(2);
                expect(result.pagination.totalPages).toBe(3);
                expect(result.pagination.totalItems).toBe(15);
                expect(result.pagination.itemsPerPage).toBe(5);
            });

            it('should handle invalid pagination parameters gracefully', async () => {
                await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'User' }
                });

                // Test with invalid page (negative)
                const result1 = await AdminService.getAllUsers({ page: -1, limit: 5 });
                expect(result1.pagination.currentPage).toBe(1);

                // Test with invalid page (zero)
                const result2 = await AdminService.getAllUsers({ page: 0, limit: 5 });
                expect(result2.pagination.currentPage).toBe(1);

                // Test with invalid limit (negative)
                const result3 = await AdminService.getAllUsers({ page: 1, limit: -5 });
                expect(result3.pagination.itemsPerPage).toBe(10);

                // Test with invalid limit (zero)
                const result4 = await AdminService.getAllUsers({ page: 1, limit: 0 });
                expect(result4.pagination.itemsPerPage).toBe(10);
            });
        });

        describe('updateUserRole', () => {
            it('should update user role successfully', async () => {
                const user = await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'Test User' }
                });

                const updatedUser = await AdminService.updateUserRole(user._id.toString(), 'VALET');

                expect(updatedUser.role).toBe('VALET');
                // Check that password is not included in the response
                expect(updatedUser).toHaveProperty('email');
                expect(updatedUser).toHaveProperty('role');
                expect(updatedUser).toHaveProperty('profile');
            });

            it('should throw error for non-existent user', async () => {
                const nonExistentId = new mongoose.Types.ObjectId().toString();

                await expect(
                    AdminService.updateUserRole(nonExistentId, 'VALET')
                ).rejects.toThrow(AppError);
            });
        });

        describe('deleteUser', () => {
            it('should delete user successfully when no active bookings', async () => {
                const user = await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'Test User' }
                });

                await AdminService.deleteUser(user._id.toString());

                const deletedUser = await User.findById(user._id);
                expect(deletedUser).toBeNull();
            });

            it('should throw error for non-existent user', async () => {
                const nonExistentId = new mongoose.Types.ObjectId().toString();

                await expect(
                    AdminService.deleteUser(nonExistentId)
                ).rejects.toThrow(AppError);
            });

            it('should throw error when user has active bookings', async () => {
                const user = await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'Test User' }
                });

                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                // Create active booking
                await Booking.create({
                    userId: user._id,
                    locationId: location._id,
                    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                    status: 'PENDING',
                    price: 25
                });

                await expect(
                    AdminService.deleteUser(user._id.toString())
                ).rejects.toThrow(AppError);
            });
        });
    });

    describe('Valet Management', () => {
        describe('getAllValets', () => {
            it('should return valets with statistics', async () => {
                const valet = await User.create({
                    email: 'valet@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'VALET',
                    profile: { name: 'Test Valet' }
                });

                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                // Create some bookings for statistics (all in the future)
                await Promise.all([
                    Booking.create({
                        userId: new mongoose.Types.ObjectId(),
                        locationId: location._id,
                        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                        status: 'COMPLETED',
                        price: 25
                    }),
                    Booking.create({
                        userId: new mongoose.Types.ObjectId(),
                        locationId: location._id,
                        startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
                        endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
                        status: 'PENDING',
                        price: 30
                    })
                ]);

                const valets = await AdminService.getAllValets();

                expect(valets).toHaveLength(1);
                expect(valets[0]?.email).toBe('valet@example.com');
                expect(valets[0]?.statistics).toBeDefined();
                expect(valets[0]?.statistics?.totalBookings).toBe(2);
                expect(valets[0]?.statistics?.completedBookings).toBe(1);
                expect(valets[0]?.statistics?.totalRevenue).toBe(25);
            });

            it('should return valets with zero statistics when no bookings', async () => {
                await User.create({
                    email: 'valet@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'VALET',
                    profile: { name: 'Test Valet' }
                });

                const valets = await AdminService.getAllValets();

                expect(valets).toHaveLength(1);
                expect(valets[0]?.statistics?.totalBookings).toBe(0);
                expect(valets[0]?.statistics?.completedBookings).toBe(0);
                expect(valets[0]?.statistics?.totalRevenue).toBe(0);
            });
        });

        describe('createValet', () => {
            it('should create valet successfully', async () => {
                const valetData = {
                    email: 'newvalet@example.com',
                    password: 'password123',
                    profile: { name: 'New Valet', phone: '123-456-7890' },
                    role: 'VALET' as const
                };

                const valet = await AdminService.createValet(valetData);

                expect(valet.email).toBe(valetData.email);
                expect(valet.role).toBe('VALET');
                expect(valet.profile.name).toBe(valetData.profile.name);
            });

            it('should throw error for duplicate email', async () => {
                const valetData = {
                    email: 'valet@example.com',
                    password: 'password123',
                    profile: { name: 'Valet' },
                    role: 'VALET' as const
                };

                // Create first valet
                await User.create({
                    email: valetData.email,
                    password: await bcrypt.hash('password123', 10),
                    role: 'VALET',
                    profile: { name: 'Existing Valet' }
                });

                await expect(
                    AdminService.createValet(valetData)
                ).rejects.toThrow(AppError);
            });
        });

        describe('updateValet', () => {
            it('should update valet profile successfully', async () => {
                const valet = await User.create({
                    email: 'valet@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'VALET',
                    profile: { name: 'Original Name' }
                });

                const updateData = {
                    profile: { name: 'Updated Name', phone: '123-456-7890' }
                };

                const updatedValet = await AdminService.updateValet(valet._id.toString(), updateData);

                expect(updatedValet.profile.name).toBe('Updated Name');
                expect(updatedValet.profile.phone).toBe('123-456-7890');
            });

            it('should throw error for non-existent valet', async () => {
                const nonExistentId = new mongoose.Types.ObjectId().toString();

                await expect(
                    AdminService.updateValet(nonExistentId, { profile: { name: 'Test' } })
                ).rejects.toThrow(AppError);
            });
        });

        describe('deleteValet', () => {
            it('should delete valet successfully', async () => {
                const valet = await User.create({
                    email: 'valet@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'VALET',
                    profile: { name: 'Test Valet' }
                });

                await AdminService.deleteValet(valet._id.toString());

                const deletedValet = await User.findById(valet._id);
                expect(deletedValet).toBeNull();
            });

            it('should throw error for non-existent valet', async () => {
                const nonExistentId = new mongoose.Types.ObjectId().toString();

                await expect(
                    AdminService.deleteValet(nonExistentId)
                ).rejects.toThrow(AppError);
            });
        });
    });

    describe('Location Management', () => {
        describe('createLocation', () => {
            it('should create location successfully', async () => {
                const locationData = {
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 }
                };

                const location = await AdminService.createLocation(locationData);

                expect(location.name).toBe(locationData.name);
                expect(location.address).toBe(locationData.address);
                expect(location.coordinates.latitude).toBe(locationData.coordinates.latitude);
                expect(location.isActive).toBe(true);
            });

            it('should throw error for invalid coordinates', async () => {
                const locationData = {
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 91, longitude: -74.0060 } // Invalid latitude
                };

                await expect(
                    AdminService.createLocation(locationData)
                ).rejects.toThrow(AppError);
            });

            it('should throw error for invalid longitude', async () => {
                const locationData = {
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: 181 } // Invalid longitude
                };

                await expect(
                    AdminService.createLocation(locationData)
                ).rejects.toThrow(AppError);
            });
        });

        describe('updateLocation', () => {
            it('should update location successfully', async () => {
                const location = await Location.create({
                    name: 'Original Location',
                    address: '123 Original St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const updateData = {
                    name: 'Updated Location',
                    coordinates: { latitude: 41.8781, longitude: -87.6298 }
                };

                const updatedLocation = await AdminService.updateLocation(location._id.toString(), updateData);

                expect(updatedLocation.name).toBe('Updated Location');
                expect(updatedLocation.coordinates.latitude).toBe(41.8781);
            });

            it('should throw error for invalid coordinates in update', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const updateData = {
                    coordinates: { latitude: -91, longitude: -74.0060 } // Invalid latitude
                };

                await expect(
                    AdminService.updateLocation(location._id.toString(), updateData)
                ).rejects.toThrow(AppError);
            });

            it('should throw error for invalid longitude in update', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const updateData = {
                    coordinates: { latitude: 40.7128, longitude: -181 } // Invalid longitude
                };

                await expect(
                    AdminService.updateLocation(location._id.toString(), updateData)
                ).rejects.toThrow(AppError);
            });

            it('should throw error for non-existent location', async () => {
                const nonExistentId = new mongoose.Types.ObjectId().toString();

                await expect(
                    AdminService.updateLocation(nonExistentId, { name: 'Test' })
                ).rejects.toThrow(AppError);
            });
        });

        describe('deleteLocation', () => {
            it('should delete location successfully when no active bookings', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                await AdminService.deleteLocation(location._id.toString());

                const deletedLocation = await Location.findById(location._id);
                expect(deletedLocation).toBeNull();
            });

            it('should throw error for non-existent location', async () => {
                const nonExistentId = new mongoose.Types.ObjectId().toString();

                await expect(
                    AdminService.deleteLocation(nonExistentId)
                ).rejects.toThrow(AppError);
            });

            it('should throw error when location has active bookings', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                // Create active booking
                await Booking.create({
                    userId: new mongoose.Types.ObjectId(),
                    locationId: location._id,
                    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                    status: 'PENDING',
                    price: 25
                });

                await expect(
                    AdminService.deleteLocation(location._id.toString())
                ).rejects.toThrow(AppError);
            });
        });
    });

    describe('Schedule Management', () => {
        describe('getAllSchedules', () => {
            it('should return all schedules with location details', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                await Schedule.create({
                    locationId: location._id,
                    dayOfWeek: 1,
                    startTime: '09:00',
                    endTime: '17:00',
                    isActive: true
                });

                const schedules = await AdminService.getAllSchedules();

                expect(schedules).toHaveLength(1);
                expect(schedules[0]?.dayOfWeek).toBe(1);
                expect(schedules[0]?.startTime).toBe('09:00');
            });
        });

        describe('createSchedule', () => {
            it('should create schedule successfully', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const scheduleData = {
                    locationId: location._id.toString(),
                    dayOfWeek: 1,
                    startTime: '09:00',
                    endTime: '17:00'
                };

                const schedule = await AdminService.createSchedule(scheduleData);

                expect(schedule.dayOfWeek).toBe(1);
                expect(schedule.startTime).toBe('09:00');
                expect(schedule.isActive).toBe(true);
            });

            it('should throw error for duplicate schedule', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const scheduleData = {
                    locationId: location._id.toString(),
                    dayOfWeek: 1,
                    startTime: '09:00',
                    endTime: '17:00'
                };

                // Create first schedule
                await Schedule.create({
                    locationId: location._id,
                    dayOfWeek: 1,
                    startTime: '09:00',
                    endTime: '17:00',
                    isActive: true
                });

                await expect(
                    AdminService.createSchedule(scheduleData)
                ).rejects.toThrow(AppError);
            });
        });

        describe('updateSchedule', () => {
            it('should update schedule successfully', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const schedule = await Schedule.create({
                    locationId: location._id,
                    dayOfWeek: 1,
                    startTime: '09:00',
                    endTime: '17:00',
                    isActive: true
                });

                const updateData = {
                    startTime: '08:00',
                    endTime: '18:00'
                };

                const updatedSchedule = await AdminService.updateSchedule(schedule._id.toString(), updateData);

                expect(updatedSchedule.startTime).toBe('08:00');
                expect(updatedSchedule.endTime).toBe('18:00');
            });

            it('should throw error for non-existent schedule', async () => {
                const nonExistentId = new mongoose.Types.ObjectId().toString();

                await expect(
                    AdminService.updateSchedule(nonExistentId, { startTime: '08:00' })
                ).rejects.toThrow(AppError);
            });
        });

        describe('deleteSchedule', () => {
            it('should delete schedule successfully', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const schedule = await Schedule.create({
                    locationId: location._id,
                    dayOfWeek: 1,
                    startTime: '09:00',
                    endTime: '17:00',
                    isActive: true
                });

                await AdminService.deleteSchedule(schedule._id.toString());

                const deletedSchedule = await Schedule.findById(schedule._id);
                expect(deletedSchedule).toBeNull();
            });

            it('should throw error for non-existent schedule', async () => {
                const nonExistentId = new mongoose.Types.ObjectId().toString();

                await expect(
                    AdminService.deleteSchedule(nonExistentId)
                ).rejects.toThrow(AppError);
            });
        });

        describe('createBulkSchedules', () => {
            it('should create multiple schedules successfully', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const schedules = [
                    { locationId: location._id.toString(), dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
                    { locationId: location._id.toString(), dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
                    { locationId: location._id.toString(), dayOfWeek: 3, startTime: '09:00', endTime: '17:00' }
                ];

                const result = await AdminService.createBulkSchedules(location._id.toString(), schedules);

                expect(result.successful).toHaveLength(3);
                expect(result.failed).toHaveLength(0);
            });

            it('should handle partial failures gracefully', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                // Create existing schedule for day 1
                await Schedule.create({
                    locationId: location._id,
                    dayOfWeek: 1,
                    startTime: '09:00',
                    endTime: '17:00',
                    isActive: true
                });

                const schedules = [
                    { locationId: location._id.toString(), dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }, // This will fail (duplicate)
                    { locationId: location._id.toString(), dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }, // This will succeed
                    { locationId: location._id.toString(), dayOfWeek: 3, startTime: '09:00', endTime: '17:00' }  // This will succeed
                ];

                const result = await AdminService.createBulkSchedules(location._id.toString(), schedules);

                expect(result.successful).toHaveLength(2);
                expect(result.failed).toHaveLength(1);
                expect(result.failed[0]?.schedule.dayOfWeek).toBe(1);
            });
        });
    });

    describe('Booking Oversight', () => {
        describe('getAllBookings', () => {
            it('should return all bookings without filters', async () => {
                const user = await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'Test User' }
                });

                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                await Booking.create({
                    userId: user._id,
                    locationId: location._id,
                    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                    status: 'PENDING',
                    price: 25
                });

                const bookings = await AdminService.getAllBookings({});

                expect(bookings).toHaveLength(1);
                expect(bookings[0]?.status).toBe('PENDING');
            });

            it('should filter bookings by status', async () => {
                const user = await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'Test User' }
                });

                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                await Promise.all([
                    Booking.create({
                        userId: user._id,
                        locationId: location._id,
                        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                        status: 'PENDING',
                        price: 25
                    }),
                    Booking.create({
                        userId: user._id,
                        locationId: location._id,
                        startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
                        endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
                        status: 'COMPLETED',
                        price: 30
                    })
                ]);

                const pendingBookings = await AdminService.getAllBookings({ status: 'PENDING' });
                const completedBookings = await AdminService.getAllBookings({ status: 'COMPLETED' });

                expect(pendingBookings).toHaveLength(1);
                expect(completedBookings).toHaveLength(1);
                expect(pendingBookings[0]?.status).toBe('PENDING');
                expect(completedBookings[0]?.status).toBe('COMPLETED');
            });

            it('should filter bookings by date range', async () => {
                const user = await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'Test User' }
                });

                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const dayAfterTomorrow = new Date(today);
                dayAfterTomorrow.setDate(today.getDate() + 2);

                await Promise.all([
                    Booking.create({
                        userId: user._id,
                        locationId: location._id,
                        startTime: tomorrow,
                        endTime: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
                        status: 'PENDING',
                        price: 25
                    }),
                    Booking.create({
                        userId: user._id,
                        locationId: location._id,
                        startTime: dayAfterTomorrow,
                        endTime: new Date(dayAfterTomorrow.getTime() + 2 * 60 * 60 * 1000),
                        status: 'PENDING',
                        price: 30
                    })
                ]);

                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                const filteredBookings = await AdminService.getAllBookings({
                    startDate: tomorrowStr,
                    endDate: tomorrowStr
                });

                expect(filteredBookings).toHaveLength(1);
            });

            it('should handle invalid date formats gracefully', async () => {
                const bookings = await AdminService.getAllBookings({
                    startDate: 'invalid-date',
                    endDate: 'also-invalid'
                });

                expect(bookings).toHaveLength(0);
            });

            it('should handle malformed date strings', async () => {
                const bookings = await AdminService.getAllBookings({
                    startDate: '2024-13-45', // Invalid month and day
                    endDate: '2024-02-30'    // Invalid day for February
                });

                expect(bookings).toHaveLength(0);
            });
        });

        describe('updateBookingStatus', () => {
            it('should update booking status with valid transition', async () => {
                const user = await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'Test User' }
                });

                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const booking = await Booking.create({
                    userId: user._id,
                    locationId: location._id,
                    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                    status: 'PENDING',
                    price: 25
                });

                const updatedBooking = await AdminService.updateBookingStatus(booking._id.toString(), 'CONFIRMED');

                expect(updatedBooking.status).toBe('CONFIRMED');
            });

            it('should throw error for non-existent booking', async () => {
                const nonExistentId = new mongoose.Types.ObjectId().toString();

                await expect(
                    AdminService.updateBookingStatus(nonExistentId, 'CONFIRMED')
                ).rejects.toThrow(AppError);
            });

            it('should throw error for invalid status transition', async () => {
                const user = await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'Test User' }
                });

                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const booking = await Booking.create({
                    userId: user._id,
                    locationId: location._id,
                    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                    status: 'COMPLETED',
                    price: 25
                });

                await expect(
                    AdminService.updateBookingStatus(booking._id.toString(), 'PENDING')
                ).rejects.toThrow(AppError);
            });
        });
    });

    describe('Analytics', () => {
        describe('getAnalyticsOverview', () => {
            it('should return analytics overview', async () => {
                // Create test data
                await User.create({
                    email: 'user@example.com',
                    password: await bcrypt.hash('password123', 10),
                    role: 'CUSTOMER',
                    profile: { name: 'Test User' }
                });

                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                await Booking.create({
                    userId: new mongoose.Types.ObjectId(),
                    locationId: location._id,
                    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                    status: 'COMPLETED',
                    price: 25
                });

                const analytics = await AdminService.getAnalyticsOverview();

                expect(analytics.totalUsers).toBe(1);
                expect(analytics.totalBookings).toBe(1);
                expect(analytics.totalRevenue).toBe(25);
                expect(analytics.activeLocations).toBe(1);
            });

            it('should handle empty data gracefully', async () => {
                const analytics = await AdminService.getAnalyticsOverview();

                expect(analytics.totalUsers).toBe(0);
                expect(analytics.totalBookings).toBe(0);
                expect(analytics.totalRevenue).toBe(0);
                expect(analytics.activeLocations).toBe(0);
            });
        });

        describe('getRevenueAnalytics', () => {
            it('should return revenue analytics without filters', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                await Promise.all([
                    Booking.create({
                        userId: new mongoose.Types.ObjectId(),
                        locationId: location._id,
                        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                        status: 'COMPLETED',
                        price: 25
                    }),
                    Booking.create({
                        userId: new mongoose.Types.ObjectId(),
                        locationId: location._id,
                        startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
                        endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
                        status: 'COMPLETED',
                        price: 30
                    })
                ]);

                const analytics = await AdminService.getRevenueAnalytics({});

                expect(analytics.totalRevenue).toBe(55);
                expect(analytics.averageBookingValue).toBe(27.5);
                expect(analytics.monthlyRevenue).toBeDefined();
            });

            it('should filter revenue analytics by date range', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const dayAfterTomorrow = new Date(today);
                dayAfterTomorrow.setDate(today.getDate() + 2);

                await Promise.all([
                    Booking.create({
                        userId: new mongoose.Types.ObjectId(),
                        locationId: location._id,
                        startTime: tomorrow,
                        endTime: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
                        status: 'COMPLETED',
                        price: 25
                    }),
                    Booking.create({
                        userId: new mongoose.Types.ObjectId(),
                        locationId: location._id,
                        startTime: dayAfterTomorrow,
                        endTime: new Date(dayAfterTomorrow.getTime() + 2 * 60 * 60 * 1000),
                        status: 'COMPLETED',
                        price: 30
                    })
                ]);

                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                const analytics = await AdminService.getRevenueAnalytics({
                    startDate: tomorrowStr,
                    endDate: tomorrowStr
                });

                expect(analytics.totalRevenue).toBe(25);
            });

            it('should handle invalid date formats in revenue analytics', async () => {
                const analytics = await AdminService.getRevenueAnalytics({
                    startDate: 'invalid-date',
                    endDate: 'also-invalid'
                });

                expect(analytics.totalRevenue).toBe(0);
                expect(analytics.averageBookingValue).toBe(0);
            });

            it('should handle malformed date strings in revenue analytics', async () => {
                const analytics = await AdminService.getRevenueAnalytics({
                    startDate: '2024-13-45', // Invalid month and day
                    endDate: '2024-02-30'    // Invalid day for February
                });

                expect(analytics.totalRevenue).toBe(0);
                expect(analytics.averageBookingValue).toBe(0);
            });
        });

        describe('getBookingAnalytics', () => {
            it('should return booking analytics', async () => {
                const location = await Location.create({
                    name: 'Test Location',
                    address: '123 Test St',
                    coordinates: { latitude: 40.7128, longitude: -74.0060 },
                    isActive: true
                });

                await Promise.all([
                    Booking.create({
                        userId: new mongoose.Types.ObjectId(),
                        locationId: location._id,
                        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
                        status: 'COMPLETED',
                        price: 25
                    }),
                    Booking.create({
                        userId: new mongoose.Types.ObjectId(),
                        locationId: location._id,
                        startTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
                        endTime: new Date(Date.now() + 50 * 60 * 60 * 1000),
                        status: 'PENDING',
                        price: 30
                    })
                ]);

                const analytics = await AdminService.getBookingAnalytics();

                expect(analytics.totalBookings).toBe(2);
                expect(analytics.bookingsByStatus).toHaveLength(2);
                expect(analytics.bookingsByLocation).toHaveLength(1);
                expect(analytics.dailyBookings).toHaveLength(2);
            });

            it('should handle empty booking data', async () => {
                const analytics = await AdminService.getBookingAnalytics();

                expect(analytics.totalBookings).toBe(0);
                expect(analytics.bookingsByStatus).toHaveLength(0);
                expect(analytics.bookingsByLocation).toHaveLength(0);
                expect(analytics.dailyBookings).toHaveLength(0);
            });
        });
    });
}); 