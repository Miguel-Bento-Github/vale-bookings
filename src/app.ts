import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import locationRoutes from './routes/locations';
import bookingRoutes from './routes/bookings';
import scheduleRoutes from './routes/schedules';
import adminRoutes from './routes/admin';
import { AppError } from './types';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging
app.use(morgan('dev'));

// Content type validation middleware
app.use((req: Request, res: Response, next: NextFunction): void => {
    // Only check POST/PUT/PATCH requests that should have JSON bodies
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');

        // If content-type is explicitly set to something other than JSON, reject it
        if (contentType && contentType.includes('text/plain')) {
            res.status(400).json({
                success: false,
                message: 'Invalid JSON payload'
            });
            return;
        }
    }
    next();
});

// JSON parsing with error handling
app.use(express.json({
    limit: '10kb', // Limit payload size
    verify: (req: Request, res: Response, buf: Buffer, encoding: string) => {
        try {
            JSON.parse(buf.toString());
        } catch (e) {
            res.status(400).json({
                success: false,
                message: 'Invalid JSON payload'
            });
            throw new Error('Invalid JSON');
        }
    }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/admin', adminRoutes);

// Test routes for error handling
app.get('/api/test-error', () => {
    throw new AppError('Test error', 400);
});

app.get('/api/test-unknown-error', () => {
    throw new Error('Unknown error');
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message
        });
    } else {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

export default app; 