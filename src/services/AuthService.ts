import jwt from 'jsonwebtoken';
import UserService from './UserService';
import { IRegisterRequest, ILoginRequest, IAuthTokens, IJWTPayload, IUserDocument, UserRole } from '../types';
import { AppError } from '../types';

class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  private readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  async register(registerData: IRegisterRequest & { role?: UserRole }): Promise<{ user: IUserDocument; tokens: IAuthTokens }> {
    const userData = {
      ...registerData,
      role: registerData.role || 'CUSTOMER' as UserRole
    };
    const user = await UserService.createUser(userData);
    const tokens = this.generateTokens(user);
    
    return { user, tokens };
  }

  async login(loginData: ILoginRequest): Promise<{ user: IUserDocument; tokens: IAuthTokens }> {
    const user = await UserService.findByEmail(loginData.email);
    
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await user.comparePassword(loginData.password);
    
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const tokens = this.generateTokens(user);
    
    return { user, tokens };
  }

  generateTokens(user: IUserDocument): IAuthTokens {
    const payload: IJWTPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(
      payload, 
      this.JWT_SECRET as string, 
      { expiresIn: this.JWT_EXPIRES_IN } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      payload, 
      this.JWT_REFRESH_SECRET as string, 
      { expiresIn: this.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  verifyToken(token: string): IJWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as IJWTPayload;
    } catch (error) {
      throw new AppError('Invalid token', 401);
    }
  }

  verifyRefreshToken(token: string): IJWTPayload {
    try {
      return jwt.verify(token, this.JWT_REFRESH_SECRET) as IJWTPayload;
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  async refreshTokens(refreshToken: string): Promise<IAuthTokens> {
    const payload = this.verifyRefreshToken(refreshToken);
    
    const user = await UserService.findById(payload.userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return this.generateTokens(user);
  }

  async getCurrentUser(userId: string): Promise<IUserDocument | null> {
    return await UserService.findById(userId);
  }
}

export default new AuthService(); 