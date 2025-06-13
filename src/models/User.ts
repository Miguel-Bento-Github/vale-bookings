import { hash, compare } from 'bcryptjs';
import mongoose, { Schema } from 'mongoose';

import { IUserDocument } from '../types';

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long']
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'VALET', 'ADMIN'],
      default: 'CUSTOMER'
    },
    profile: {
      name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
      },
      phone: {
        type: String,
        trim: true,
        match: [
          /^\+?[\d\s-()]+$/,
          'Please provide a valid phone number'
        ]
      }
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret): Record<string, unknown> => {
        delete ret.password;
        return ret;
      }
    }
  }
);

// Index for performance
UserSchema.index({ email: 1 });

// Pre-save middleware to hash password
UserSchema.pre('save', async function (next): Promise<void> {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const hashedPassword = await hash(String(this.password), 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return compare(candidatePassword, String(this.password));
};

// Static method to find user by email
UserSchema.statics.findByEmail = function (email: string): Promise<IUserDocument | null> {
  return this.findOne({ email: email.toLowerCase() });
};

export default mongoose.model<IUserDocument>('User', UserSchema); 