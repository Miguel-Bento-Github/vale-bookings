import mongoose, { Schema } from 'mongoose';
import { ILocationDocument } from '../types';

const CoordinatesSchema = new Schema(
  {
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    }
  },
  { _id: false }
);

const LocationSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
      maxlength: [200, 'Location name cannot exceed 200 characters']
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters']
    },
    coordinates: {
      type: CoordinatesSchema,
      required: [true, 'Coordinates are required']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Create geospatial index for location queries
LocationSchema.index({
  'coordinates.latitude': 1,
  'coordinates.longitude': 1
});

// Create text index for searching by name and address
LocationSchema.index({
  name: 'text',
  address: 'text'
});

// Static method to find locations within radius
LocationSchema.statics.findNearby = function (
  latitude: number,
  longitude: number,
  radiusInKm: number = 10
) {
  // Convert radius from kilometers to radians
  const radiusInRadians = radiusInKm / 6371;

  return this.find({
    isActive: true,
    'coordinates.latitude': {
      $gte: latitude - radiusInRadians,
      $lte: latitude + radiusInRadians
    },
    'coordinates.longitude': {
      $gte: longitude - radiusInRadians,
      $lte: longitude + radiusInRadians
    }
  });
};

// Static method to search by name or address
LocationSchema.statics.search = function (query: string) {
  return this.find({
    isActive: true,
    $text: { $search: query }
  });
};

export default mongoose.model<ILocationDocument>('Location', LocationSchema); 