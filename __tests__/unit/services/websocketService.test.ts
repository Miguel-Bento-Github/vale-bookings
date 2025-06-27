import * as WebSocketService from '../../../src/services/WebSocketService';

// Utility to force-set the module-private io instance
function setMockIo(mock: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (WebSocketService as any).io = mock;
}

describe('WebSocketService utility emitters', () => {
  afterEach(() => {
    jest.clearAllMocks();
    setMockIo(null); // reset
  });

  it('emitBookingUpdate executes without server and with mock server', () => {
    WebSocketService.emitBookingUpdate({
      bookingId: 'x',
      status: 'CONFIRMED',
      locationId: 'loc',
      userId: 'u',
      timestamp: new Date()
    });

    setMockIo({ to: jest.fn().mockReturnValue({ emit: jest.fn() }), emit: jest.fn() });
    WebSocketService.emitBookingUpdate({
      bookingId: 'x',
      status: 'COMPLETED',
      locationId: 'loc',
      userId: 'u',
      timestamp: new Date()
    });
  });

  it('emitLocationUpdate executes safely', () => {
    WebSocketService.emitLocationUpdate({
      locationId: 'loc',
      currentOccupancy: 0,
      capacity: 10,
      availableSpots: 10,
      timestamp: new Date()
    });

    setMockIo({ to: jest.fn().mockReturnValue({ emit: jest.fn() }), emit: jest.fn() });
    WebSocketService.emitLocationUpdate({
      locationId: 'loc',
      currentOccupancy: 1,
      capacity: 10,
      availableSpots: 9,
      timestamp: new Date()
    });
  });

  it('sendUserNotification executes with mock server', () => {
    setMockIo({ to: jest.fn().mockReturnValue({ emit: jest.fn() }), emit: jest.fn() });
    WebSocketService.sendUserNotification({
      userId: 'u1',
      type: 'booking_cancelled',
      title: 'Cancelled',
      message: 'Your booking was cancelled',
      timestamp: new Date()
    });
  });
}); 