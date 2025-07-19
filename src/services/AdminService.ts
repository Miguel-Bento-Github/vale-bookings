// Re-export all admin services from the modular structure
// Keep backward compatibility by re-exporting everything
// This ensures existing imports continue to work
import * as Analytics from './admin/AnalyticsService';
import * as BookingManagement from './admin/BookingManagementService';
import * as LocationManagement from './admin/LocationManagementService';
import * as UserManagement from './admin/UserManagementService';
import * as ValetManagement from './admin/ValetManagementService';

// User Management
export const createUser = UserManagement.createUser;
export const getUserById = UserManagement.getUserById;
export const getAllUsers = UserManagement.getAllUsers;
export const updateUser = UserManagement.updateUser;
export const updateUserRole = UserManagement.updateUserRole;
export const getUserStats = UserManagement.getUserStats;
export const deleteUser = UserManagement.deleteUser;

// Booking Management
export const getAllBookings = BookingManagement.getAllBookings;
export const updateBookingStatus = BookingManagement.updateBookingStatus;
export const getBookingById = BookingManagement.getBookingById;
export const deleteBooking = BookingManagement.deleteBooking;

// Location Management
export const createLocation = LocationManagement.createLocation;
export const getLocationById = LocationManagement.getLocationById;
export const getAllLocations = LocationManagement.getAllLocations;
export const updateLocation = LocationManagement.updateLocation;
export const deleteLocation = LocationManagement.deleteLocation;

// Schedule Management
export const createSchedule = LocationManagement.createSchedule;
export const getScheduleById = LocationManagement.getScheduleById;
export const getLocationSchedules = LocationManagement.getLocationSchedules;
export const updateSchedule = LocationManagement.updateSchedule;
export const deleteSchedule = LocationManagement.deleteSchedule;
export const createBulkSchedules = LocationManagement.createBulkSchedules;

// Valet Management
export const createValet = ValetManagement.createValet;
export const getValetById = ValetManagement.getValetById;
export const getAllValets = ValetManagement.getAllValets;
export const updateValet = ValetManagement.updateValet;
export const deleteValet = ValetManagement.deleteValet;
export const assignValetToLocation = ValetManagement.assignValetToLocation;
export const unassignValetFromLocation = ValetManagement.unassignValetFromLocation;
export const getValetStats = ValetManagement.getValetStats;

// Analytics
export const getOverviewStats = Analytics.getOverviewStats;
export const getBookingAnalytics = Analytics.getBookingAnalytics;
export const getRevenueAnalytics = Analytics.getRevenueAnalytics;