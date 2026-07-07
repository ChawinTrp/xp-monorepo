import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GCalService } from './gcal.service';
import { Node } from '../nodes/node.entity';
import { GCalState } from './gcal-state.schema';

describe('GCalService state persistence', () => {
  const storedTokens = {
    access_token: 'a',
    refresh_token: 'r',
    expiry_date: 123,
  };

  let stateModel: {
    findOne: jest.Mock;
    updateOne: jest.Mock;
  };

  const makeService = async () => {
    const module = await Test.createTestingModule({
      providers: [
        GCalService,
        { provide: getModelToken(Node.name), useValue: {} },
        { provide: getModelToken(GCalState.name), useValue: stateModel },
      ],
    }).compile();
    return module.get(GCalService);
  };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    stateModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    jest.restoreAllMocks();
  });

  it('restores tokens + calendarId from DB on init', async () => {
    stateModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ tokens: storedTokens, calendarId: 'cal_1' }),
    });
    const service = await makeService();
    await service.onModuleInit();
    expect(service.isConnected()).toBe(true);
    expect(service.getStatus().calendarId).toBe('cal_1');
  });

  it('stays disconnected when DB has no state', async () => {
    const service = await makeService();
    await service.onModuleInit();
    expect(service.isConnected()).toBe(false);
  });

  it('persists tokens after handleCallback', async () => {
    const service = await makeService();
    await service.onModuleInit();
    jest
      .spyOn((service as any).oauth2Client, 'getToken')
      .mockResolvedValue({ tokens: storedTokens } as any);
    jest
      .spyOn(service as any, 'ensureXPCalendar')
      .mockResolvedValue(undefined);
    await service.handleCallback('code123');
    expect(stateModel.updateOne).toHaveBeenCalledWith(
      {},
      { $set: { tokens: storedTokens, calendarId: null } },
      { upsert: true },
    );
  });
});
