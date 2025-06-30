import mongoose, { Schema } from 'mongoose';

import { ILocationDocument } from '../types';

const CoordinatesSchema = new Schema(
  {
    latitude: {
      type: Number,
      alias: 'lat',
      required: [true, 'Latitude is required'],
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      alias: 'lng',
      required: [true, 'Longitude is required'],
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    }
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
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
    services: {
      type: [String],
      default: [],
      index: true
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

// Create compound unique index to prevent duplicate locations with same name AND address
// This allows multiple establishments at the same address with different names
LocationSchema.index({
  name: 1,
  address: 1
}, {
  unique: true,
  name: 'unique_name_address'
});

// Allow using lat/lng on root object when creating documents (used in some tests)
LocationSchema.pre('validate', function (next) {
  // `this` is a Mongoose document
  const doc = this as ILocationDocument & {
    lat?: number;
    lng?: number;
    coordinates?: {
      latitude?: number;
      longitude?: number;
      lat?: number;
      lng?: number;
    };
  };

  // If coordinates absent but lat/lng present at root -> map them
  if (doc.coordinates == null && doc.lat != null && doc.lng != null) {
    doc.coordinates = { latitude: doc.lat, longitude: doc.lng };
  }

  // If coordinates exist but use `lat`/`lng` property names -> normalise
  if (doc.coordinates != null) {
    const c = doc.coordinates;
    if (c.lat != null && c.latitude == null) c.latitude = c.lat;
    if (c.lng != null && c.longitude == null) c.longitude = c.lng;
  }

  next();
});

// Static method to find locations within radius
LocationSchema.statics.findNearby = function (
  latitude: number,
  longitude: number,
  radiusInKm: number = 10
): Promise<ILocationDocument[]> {
  // Use a more generous bounding box to ensure we capture all nearby locations
  // Convert radius from kilometers to degrees (rough approximation)
  const radiusInDegrees = radiusInKm / 111.32; // 1 degree ≈ 111.32 km

  return this.find({
    isActive: true,
    'coordinates.latitude': {
      $gte: latitude - radiusInDegrees,
      $lte: latitude + radiusInDegrees
    },
    'coordinates.longitude': {
      $gte: longitude - radiusInDegrees,
      $lte: longitude + radiusInDegrees
    }
  });
};

// Static method to search by name or address
LocationSchema.statics.search = function (query: string): Promise<ILocationDocument[]> {
  return this.find({
    isActive: true,
    $text: { $search: query }
  });
};

export default mongoose.model<ILocationDocument>('Location', LocationSchema); 