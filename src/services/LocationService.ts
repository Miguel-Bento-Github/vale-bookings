import Location from '../models/Location';
import { ILocation, ILocationDocument, IUpdateLocationRequest } from '../types';
import { AppError } from '../types';

class LocationService {
  async createLocation(locationData: ILocation): Promise<ILocationDocument> {
    const location = new Location(locationData);
    return await location.save();
  }

  async findById(locationId: string): Promise<ILocationDocument | null> {
    return await Location.findById(locationId);
  }

  async getAllLocations(activeOnly: boolean = true): Promise<ILocationDocument[]> {
    const query = activeOnly ? { isActive: true } : {};
    return await Location.find(query).sort({ name: 1 });
  }

  async updateLocation(locationId: string, updateData: IUpdateLocationRequest): Promise<ILocationDocument | null> {
    return await Location.findByIdAndUpdate(
      locationId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async deactivateLocation(locationId: string): Promise<ILocationDocument | null> {
    return await Location.findByIdAndUpdate(
      locationId,
      { isActive: false },
      { new: true }
    );
  }

  async deleteLocation(locationId: string): Promise<void> {
    await Location.findByIdAndDelete(locationId);
  }

  async findNearby(latitude: number, longitude: number, radiusInKm: number = 10): Promise<ILocationDocument[]> {
    return await (Location as any).findNearby(latitude, longitude, radiusInKm);
  }

  async searchLocations(query: string): Promise<ILocationDocument[]> {
    return await (Location as any).search(query);
  }

  async getLocationsByCoordinates(
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
}

export default new LocationService(); 