import Location from '../models/Location';
import { ILocation, ILocationDocument, ILocationModel } from '../types';
import { AppError } from '../types';

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
      throw new AppError('Location already exists', 409);
    }
    throw error;
  }
}

export async function updateLocation(locationId: string, updateData: Partial<ILocation>): Promise<ILocationDocument | null> {
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

export async function getNearbyLocations(longitude: number, latitude: number, maxDistance: number = 5000): Promise<ILocationDocument[]> {
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

export async function findNearby(latitude: number, longitude: number, radiusInKm: number = 10): Promise<ILocationDocument[]> {
  return await (Location as unknown as ILocationModel).findNearby(latitude, longitude, radiusInKm);
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