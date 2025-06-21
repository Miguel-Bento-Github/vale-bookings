import { Document } from 'mongoose';

import { ITimestamps } from './common';

/**
 * User domain types
 */

export type UserRole = 'CUSTOMER' | 'VALET' | 'ADMIN';

export interface IUserProfile {
    name: string;
    phone?: string;
}

export interface IUser extends ITimestamps {
    email: string;
    password: string;
    role: UserRole;
    profile: IUserProfile;
}

export interface IUserDocument extends IUser, Document {
    comparePassword(candidatePassword: string): Promise<boolean>;
}

// JWT related types
export interface IJWTPayload {
    userId: string;
    email: string;
    role: UserRole;
}

export interface IAuthTokens {
    accessToken: string;
    refreshToken: string;
}

// Auth request types
export interface IRegisterRequest {
    email: string;
    password: string;
    profile: IUserProfile;
}

export interface ILoginRequest {
    email: string;
    password: string;
} 