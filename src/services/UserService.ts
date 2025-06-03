import User from '../models/User';
import { IUser, IUserDocument } from '../types';
import { AppError } from '../types';

class UserService {
  async createUser(userData: IUser): Promise<IUserDocument> {
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

  async findById(userId: string): Promise<IUserDocument | null> {
    return await User.findById(userId);
  }

  async findByEmail(email: string): Promise<IUserDocument | null> {
    return await User.findOne({ email: email.toLowerCase() });
  }

  async updateProfile(userId: string, updateData: Partial<IUser>): Promise<IUserDocument | null> {
    return await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }

  async deleteUser(userId: string): Promise<void> {
    await User.findByIdAndDelete(userId);
  }

  async getAllUsers(page: number = 1, limit: number = 10): Promise<IUserDocument[]> {
    const skip = (page - 1) * limit;
    return await User.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async getUsersByRole(role: string): Promise<IUserDocument[]> {
    return await User.find({ role });
  }

  async updateUserRole(userId: string, role: string): Promise<IUserDocument | null> {
    return await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    );
  }
}

export default new UserService(); 