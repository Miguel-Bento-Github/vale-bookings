import { ERROR_MESSAGES } from '../../constants';
import User from '../../models/User';
import { 
  IUserDocument,
  AppError,
  IPaginationOptions
} from '../../types';
import {
  standardUpdate,
  createWithDuplicateHandling,
  ensureDocumentExists,
  safeDelete
} from '../../utils/mongoHelpers';

interface IValetFilters extends IPaginationOptions {
  search?: string;
  isActive?: boolean;
  locationId?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface ICreateValetData {
  email: string;
  password: string;
  profile: {
    name: string;
    phone?: string;
    licenseNumber?: string;
    experience?: number;
  };
  assignedLocationIds?: string[];
  isActive?: boolean;
}

interface IUpdateValetData {
  email?: string;
  profile?: {
    name?: string;
    phone?: string;
    licenseNumber?: string;
    experience?: number;
  };
  assignedLocationIds?: string[];
  isActive?: boolean;
}

// Valet Management Functions
export const createValet = async (valetData: ICreateValetData): Promise<IUserDocument> => {
  const userData = {
    ...valetData,
    role: 'VALET' as const
  };

  const valet = await createWithDuplicateHandling(
    User,
    userData,
    ERROR_MESSAGES.USER_ALREADY_EXISTS
  );

  // Remove password from response
  const valetObj = valet.toObject() as Record<string, unknown>;
  delete valetObj.password;
  return valetObj as unknown as IUserDocument;
};

export const getValetById = async (valetId: string): Promise<IUserDocument> => {
  const valet = await User.findOne({ 
    _id: valetId, 
    role: 'VALET' 
  }).select('-password');

  if (!valet) {
    throw new AppError('Valet not found', 404);
  }

  return valet;
};

export const getAllValets = async (filters: IValetFilters): Promise<{
  valets: IUserDocument[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}> => {
  const page = (typeof filters.page === 'number' && filters.page > 0) ? filters.page : 1;
  const limit = (typeof filters.limit === 'number' && filters.limit > 0) ? filters.limit : 10;
  const skip = (page - 1) * limit;

  // Build query - only VALET role
  const query: Record<string, unknown> = { role: 'VALET' };

  // Active filter
  if (typeof filters.isActive === 'boolean') {
    query.isActive = filters.isActive;
  }

  // Location filter
  if (typeof filters.locationId === 'string' && filters.locationId.trim().length > 0) {
    query.assignedLocationIds = { $in: [filters.locationId] };
  }

  // Search filter
  if (typeof filters.search === 'string' && filters.search.trim().length > 0) {
    const escapedSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // eslint-disable-next-line security/detect-non-literal-regexp
    const searchRegex = new RegExp(escapedSearch, 'i');
    query.$or = [
      { email: searchRegex },
      { 'profile.name': searchRegex },
      { 'profile.licenseNumber': searchRegex }
    ];
  }

  // Build sort
  const sortBy = filters.sortBy ?? 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder
  };

  const [valets, totalItems] = await Promise.all([
    User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort(sort),
    User.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    valets,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  };
};

export const updateValet = async (valetId: string, updateData: IUpdateValetData): Promise<IUserDocument> => {
  // Ensure valet exists
  const existingValet = await User.findOne({ 
    _id: valetId, 
    role: 'VALET' 
  });

  if (!existingValet) {
    throw new AppError('Valet not found', 404);
  }

  const valet = await standardUpdate(User, valetId, updateData);

  if (!valet) {
    throw new AppError('Valet not found', 404);
  }

  // Remove password from response
  const valetObj = valet.toObject() as Record<string, unknown>;
  delete valetObj.password;
  return valetObj as unknown as IUserDocument;
};

export const deleteValet = async (valetId: string): Promise<void> => {
  // Ensure valet exists
  const existingValet = await User.findOne({ 
    _id: valetId, 
    role: 'VALET' 
  });

  if (!existingValet) {
    throw new AppError('Valet not found', 404);
  }

  // Check if valet has active assignments
  // This would depend on your business logic
  // For example, check if valet has pending bookings assigned to them

  await safeDelete(User, valetId, 'Valet not found');
};

export const assignValetToLocation = async (valetId: string, locationId: string): Promise<IUserDocument> => {
  const valet = await User.findOne({ 
    _id: valetId, 
    role: 'VALET' 
  });

  if (!valet) {
    throw new AppError('Valet not found', 404);
  }

  // Add location to assigned locations if not already present
  const assignedLocationIds = Array.isArray(valet.assignedLocationIds) ? valet.assignedLocationIds : [];
  if (!assignedLocationIds.includes(locationId)) {
    assignedLocationIds.push(locationId);
  }

  const updatedValet = await standardUpdate(User, valetId, {
    assignedLocationIds
  });

  if (!updatedValet) {
    throw new AppError('Failed to assign valet to location', 500);
  }

  // Remove password from response
  const valetObj = updatedValet.toObject() as Record<string, unknown>;
  delete valetObj.password;
  return valetObj as unknown as IUserDocument;
};

export const unassignValetFromLocation = async (valetId: string, locationId: string): Promise<IUserDocument> => {
  const valet = await User.findOne({ 
    _id: valetId, 
    role: 'VALET' 
  });

  if (!valet) {
    throw new AppError('Valet not found', 404);
  }

  // Remove location from assigned locations
  const assignedLocationIds = Array.isArray(valet.assignedLocationIds) 
    ? valet.assignedLocationIds.filter((id: string) => id !== locationId) 
    : [];

  const updatedValet = await standardUpdate(User, valetId, {
    assignedLocationIds
  });

  if (!updatedValet) {
    throw new AppError('Failed to unassign valet from location', 500);
  }

  // Remove password from response
  const valetObj = updatedValet.toObject() as Record<string, unknown>;
  delete valetObj.password;
  return valetObj as unknown as IUserDocument;
};

export const getValetStats = async (valetId: string): Promise<{
  totalAssignedBookings: number;
  completedBookings: number;
  averageRating: number;
  totalHoursWorked: number;
}> => {
  // Ensure valet exists
  await ensureDocumentExists(User, valetId, 'Valet not found');

  // This would require a booking assignment system
  // For now, return placeholder data
  return {
    totalAssignedBookings: 0,
    completedBookings: 0,
    averageRating: 0,
    totalHoursWorked: 0
  };
};