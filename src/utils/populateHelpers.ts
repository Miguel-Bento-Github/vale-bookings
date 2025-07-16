interface PopulatedObject {
  _id: unknown;
  [key: string]: unknown;
}

export interface DocumentWithToJSON {
  toJSON?(): Record<string, unknown>;
  [key: string]: unknown;
}

function hasId(obj: unknown): obj is PopulatedObject {
  return obj !== null && typeof obj === 'object' && '_id' in obj;
}

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (hasId(value)) {
    return String(value._id);
  }
  return '';
}

export function transformPopulatedDocuments<T extends DocumentWithToJSON>(
  documents: T[],
  populatedField: keyof T,
  targetField: string
): Array<Record<string, unknown>> {
  return documents.map(doc => {
    const docJSON = doc.toJSON ? doc.toJSON() : doc as Record<string, unknown>;
    const populatedData = docJSON[String(populatedField)];
    
    return {
      ...docJSON,
      [targetField]: populatedData,
      [String(populatedField)]: hasId(populatedData) 
        ? String(populatedData._id) 
        : safeStringify(populatedData ?? docJSON[String(populatedField)])
    };
  });
}

export function transformBookings(bookings: DocumentWithToJSON[]): Array<Record<string, unknown>> {
  return bookings.map(booking => {
    const bookingJSON = booking.toJSON ? booking.toJSON() : booking as Record<string, unknown>;
    const populatedUser = bookingJSON.userId;
    const populatedLocation = bookingJSON.locationId;
    
    return {
      ...bookingJSON,
      user: populatedUser,
      location: populatedLocation,
      userId: hasId(populatedUser) 
        ? String(populatedUser._id) 
        : safeStringify(populatedUser ?? booking.userId),
      locationId: hasId(populatedLocation) 
        ? String(populatedLocation._id) 
        : safeStringify(populatedLocation ?? booking.locationId)
    };
  });
}

export function transformSchedules(schedules: DocumentWithToJSON[]): Array<Record<string, unknown>> {
  return transformPopulatedDocuments(schedules, 'locationId', 'location');
}