import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { Node } from './node.entity';
import { PropagationService } from './propagation.service';
import { GCalService } from '../gcal/gcal.service';

const execWith = <T>(value: T) => ({ exec: () => Promise.resolve(value) });

describe('NodesService', () => {
  let service: NodesService;
  let model: {
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
    updateMany: jest.Mock;
  };

  beforeEach(async () => {
    model = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      updateMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodesService,
        { provide: getModelToken(Node.name), useValue: model },
        { provide: PropagationService, useValue: { onTaskCompleted: jest.fn() } },
        { provide: GCalService, useValue: { isConnected: () => false } },
      ],
    }).compile();

    service = module.get<NodesService>(NodesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('archive() sets archived true and returns the node', async () => {
    const updated = { _id: '1', archived: true } as Node;
    model.findByIdAndUpdate.mockReturnValue(execWith(updated));

    const result = await service.archive('1');

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      '1',
      { archived: true },
      { returnDocument: 'after' },
    );
    expect(result).toEqual(updated);
  });

  it('archive() throws NotFoundException when node is missing', async () => {
    model.findByIdAndUpdate.mockReturnValue(execWith(null));
    await expect(service.archive('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unarchive() sets archived false and returns the node', async () => {
    const updated = { _id: '1', archived: false } as Node;
    model.findByIdAndUpdate.mockReturnValue(execWith(updated));

    const result = await service.unarchive('1');

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      '1',
      { archived: false },
      { returnDocument: 'after' },
    );
    expect(result).toEqual(updated);
  });

  it('findAll() excludes archived by default', async () => {
    model.find.mockReturnValue(execWith([]));
    await service.findAll();
    expect(model.find).toHaveBeenCalledWith({ archived: { $ne: true } });
  });

  it('findAll(true) includes archived', async () => {
    model.find.mockReturnValue(execWith([]));
    await service.findAll(true);
    expect(model.find).toHaveBeenCalledWith({});
  });

  it('searchNodes() excludes archived by default', async () => {
    model.find.mockReturnValue({ limit: () => execWith([]) });
    await service.searchNodes('xp');
    expect(model.find).toHaveBeenCalledWith({
      title: { $regex: 'xp', $options: 'i' },
      archived: { $ne: true },
    });
  });
});
