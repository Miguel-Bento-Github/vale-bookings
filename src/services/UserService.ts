import User from '../models/User';
import { IUser, IUserDocument } from '../types';
import { AppError } from '../types';

export async function createUser(userData: IUser): Promise<IUserDocument> {
  try {
    const user = new User(userData);
    return await user.save();
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 11000) {
      throw new AppError('User with this email already exists', 409);
    }
    throw error;
  }
}

export async function findById(userId: string): Promise<IUserDocument | null> {
  return await User.findById(userId);
}

export async function findByEmail(email: string): Promise<IUserDocument | null> {
  return await User.findOne({ email: email.toLowerCase() });
}

export async function updateProfile(userId: string, updateData: Partial<IUser>): Promise<IUserDocument | null> {
  if (updateData.profile) {
    const updateQuery: Record<string, unknown> = {};
    Object.keys(updateData.profile).forEach(key => {
      if (updateData.profile) {
        updateQuery[`profile.${key}`] = updateData.profile[key as keyof typeof updateData.profile];
      }
    });

    return await User.findByIdAndUpdate(
      userId,
      { $set: updateQuery },
      { new: true, runValidators: true }
    );
  }

  return await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  );
}

export async function deleteUser(userId: string): Promise<void> {
  await User.findByIdAndDelete(userId);
}

export async function getAllUsers(page: number = 1, limit: number = 10): Promise<IUserDocument[]> {
  const skip = (page - 1) * limit;
  return await User.find({})
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
}

export async function getUsersByRole(role: string): Promise<IUserDocument[]> {
  return await User.find({ role });
}

export async function updateUserRole(userId: string, role: string): Promise<IUserDocument | null> {
  return await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true, runValidators: true }
  );
} 