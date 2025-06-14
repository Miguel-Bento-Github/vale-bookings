import Location from '../models/Location';
import {
  ILocation,
  ILocationDocument,
  ILocationModel,
  ILocationAvailability,
  ILocationWithDistance,
  ITimeSlot,
  AppError
} from '../types';

export async function getAllLocations(): Promise<ILocationDocument[]> {
  return await Location.find({ isActive: true });
}

export async function getLocationById(locationId: string): Promise<ILocationDocument | null> {
  return await Location.findById(locationId);
}

export async function createLocation(locationData: ILocation): Promise<ILocationDocument> {
  try {
    const location = new Location(locationData);
    return await location.save();
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 11000) {
      // Check if it's the name+address duplicate constraint
      const mongoError = error as { keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown> };
      if (mongoError.keyPattern && 'name' in mongoError.keyPattern && 'address' in mongoError.keyPattern) {
        throw new AppError(
          `A location with the name "${locationData.name}" already exists at address "${locationData.address}". Multiple establishments can exist at the same address but must have different names.`,
          409
        );
      }
      throw new AppError('Location already exists', 409);
    }
    throw error;
  }
}

export async function updateLocation(
  locationId: string,
  updateData: Partial<ILocation>
): Promise<ILocationDocument | null> {
  return await Location.findByIdAndUpdate(
    locationId,
    { $set: updateData },
    { new: true, runValidators: true }
  );
}

export async function deleteLocation(locationId: string): Promise<void> {
  const location = await Location.findById(locationId);

  if (!location) {
    throw new AppError('Location not found', 404);
  }

  // Check if location has active bookings
  const { default: Booking } = await import('../models/Booking');
  const activeBookings = await Booking.countDocuments({
    locationId: locationId,
    status: { $in: ['PENDING', 'IN_PROGRESS'] }
  });

  if (activeBookings > 0) {
    throw new AppError('Cannot delete location with active bookings', 400);
  }

  await Location.findByIdAndDelete(locationId);
}

export async function getNearbyLocations(
  longitude: number,
  latitude: number,
  maxDistance: number = 5000
): Promise<ILocationDocument[]> {
  return await Location.find({
    isActive: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
}

export async function deactivateLocation(locationId: string): Promise<ILocationDocument | null> {
  return await Location.findByIdAndUpdate(
    locationId,
    { isActive: false },
    { new: true }
  );
}

export async function findNearby(
  latitude: number,
  longitude: number,
  radiusInKm: number = 10
): Promise<ILocationDocument[]> {
  const locations = await (Location as unknown as ILocationModel).findNearby(
    latitude,
    longitude,
    radiusInKm
  );

  // Calculate distance for each location and sort by distance
  const locationsWithDistance = locations.map(location => {
    const distance = calculateDistance(
      latitude,
      longitude,
      location.coordinates.latitude,
      location.coordinates.longitude
    );

    return {
      location,
      distance
    };
  });

  // Sort by distance (ascending) and return only the locations
  return locationsWithDistance
    .sort((a, b) => a.distance - b.distance)
    .map(item => item.location);
}

export async function searchLocations(query: string): Promise<ILocationDocument[]> {
  return await (Location as unknown as ILocationModel).search(query);
}

export async function getLocationsByCoordinates(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): Promise<ILocationDocument[]> {
  return await Location.find({
    isActive: true,
    'coordinates.latitude': { $gte: minLat, $lte: maxLat },
    'coordinates.longitude': { $gte: minLng, $lte: maxLng }
  });
}

// Phase 3: New Location Discovery Methods

export async function getLocationAvailability(
  locationId: string,
  date: Date
): Promise<ILocationAvailability> {
  const location = await getLocationById(locationId);

  if (!location) {
    throw new AppError('Location not found', 404);
  }

  // TODO: Implement real availability calculation
  // This would integrate with booking data and location capacity
  return {
    locationId,
    date,
    availableSpots: 10, // Placeholder
    totalSpots: 20,     // Placeholder
    occupancyRate: 0.5  // Placeholder
  };
}

export async function getLocationsWithDistance(
  userLatitude: number,
  userLongitude: number,
  radiusInKm: number = 10
): Promise<ILocationWithDistance[]> {
  const locations = await findNearby(userLatitude, userLongitude, radiusInKm);

  // Calculate distance for each location and sort by distance
  const locationsWithDistance: ILocationWithDistance[] = locations.map(location => {
    const distance = calculateDistance(
      userLatitude,
      userLongitude,
      location.coordinates.latitude,
      location.coordinates.longitude
    );

    // Create a properly typed location with distance
    const locationWithDistance: ILocationWithDistance = {
      name: location.name,
      address: location.address,
      coordinates: location.coordinates,
      isActive: location.isActive,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
      distance
    };

    return locationWithDistance;
  });

  // Sort by distance (ascending)
  return locationsWithDistance.sort((a, b) => a.distance - b.distance);
}

export async function getLocationTimeslots(
  locationId: string,
  date: Date
): Promise<ITimeSlot[]> {
  const location = await getLocationById(locationId);

  if (!location) {
    throw new AppError('Location not found', 404);
  }

  // TODO: Implement real timeslot generation based on:
  // - Location operating hours
  // - Existing bookings
  // - Availability rules

  // Placeholder implementation - generate hourly slots from 9 AM to 6 PM
  const timeslots: ITimeSlot[] = [];
  const baseDate = new Date(date);

  for (let hour = 9; hour < 18; hour++) {
    const startTime = new Date(baseDate);
    startTime.setHours(hour, 0, 0, 0);

    const endTime = new Date(baseDate);
    endTime.setHours(hour + 1, 0, 0, 0);

    timeslots.push({
      startTime,
      endTime,
      available: true, // Placeholder - check against bookings
      price: 25 // Placeholder pricing
    });
  }

  return timeslots;
}

// Utility function to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
} 