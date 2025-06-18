import { Request, Response } from 'express';
import morgan from 'morgan';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Setup morgan tokens only if not in test environment
if (process.env.NODE_ENV !== 'test' &&
    !process.argv.includes('--coverage') &&
    !process.argv.includes('jest')) {

  // Custom morgan token for colored status codes
  morgan.token('status-colored', (req: Request, res: Response): string => {
    const status = res.statusCode;
    let color = colors.green; // Default for 2xx

    if (status >= 500) {
      color = colors.red;
    } else if (status >= 400) {
      color = colors.yellow;
    } else if (status >= 300) {
      color = colors.cyan;
    }

    return `${color}${status}${colors.reset}`;
  });

  // Custom morgan token for colored method
  morgan.token('method-colored', (req: Request): string => {
    const method = req.method;
    let color = colors.blue;

    switch (method) {
    case 'GET':
      color = colors.green;
      break;
    case 'POST':
      color = colors.yellow;
      break;
    case 'PUT':
      color = colors.magenta;
      break;
    case 'DELETE':
      color = colors.red;
      break;
    case 'PATCH':
      color = colors.cyan;
      break;
    }

    return `${color}${method}${colors.reset}`;
  });

  // Custom morgan token for response time with color
  morgan.token('response-time-colored', (req: Request, res: Response): string => {
    const startTime = res.locals.startTime as number;
    const time = startTime ? Date.now() - startTime : 0;
    let color = colors.green;

    if (time > 1000) {
      color = colors.red;
    } else if (time > 500) {
      color = colors.yellow;
    }

    return `${color}${time.toFixed(0)}ms${colors.reset}`;
  });
}

// Middleware to track response time
export const responseTimeMiddleware = (req: Request, res: Response, next: () => void): void => {
  res.locals.startTime = Date.now();
  next();
};

// Pretty development format
const devFormat = [
  `${colors.dim}:date[iso]${colors.reset}`,
  ':method-colored',
  `${colors.white}:url${colors.reset}`,
  ':status-colored',
  ':response-time-colored',
  `${colors.dim}:res[content-length] bytes${colors.reset}`
].join(' ') + `\n${colors.dim}  ↳ :user-agent${colors.reset}`;

// Create morgan middleware with pretty formatting
export const createPrettyLogger = (): ReturnType<typeof morgan> => {
  // Disable logging during tests
  if (process.env.NODE_ENV === 'test' ||
        process.argv.includes('--coverage') ||
        process.argv.includes('jest')) {
    return morgan('dev', { skip: () => true });
  }

  if (process.env.NODE_ENV === 'development') {
    return morgan(devFormat);
  }

  // Production format (JSON for log aggregation)  
  return morgan('combined');
};

// Console log helpers with colors
export const logInfo = (message: string, ...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`, ...args);
};

export const logSuccess = (message: string, ...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`, ...args);
};

export const logWarning = (message: string, ...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.log(`${colors.yellow}[WARN]${colors.reset} ${message}`, ...args);
};

export const logError = (message: string, ...args: unknown[]): void => {
  // eslint-disable-next-line no-console
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`, ...args);
}; 