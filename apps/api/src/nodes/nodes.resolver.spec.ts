import { Test, TestingModule } from '@nestjs/testing';
import { NodesResolver } from './nodes.resolver';
import { NodesService } from './nodes.service';
import { PropagationService } from './propagation.service';

describe('NodesResolver', () => {
  let resolver: NodesResolver;
  let nodesService: { archive: jest.Mock; unarchive: jest.Mock };

  beforeEach(async () => {
    nodesService = { archive: jest.fn(), unarchive: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodesResolver,
        { provide: NodesService, useValue: nodesService },
        { provide: PropagationService, useValue: {} },
      ],
    }).compile();

    resolver = module.get<NodesResolver>(NodesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('archiveNode delegates to nodesService.archive', () => {
    resolver.archiveNode('1');
    expect(nodesService.archive).toHaveBeenCalledWith('1');
  });

  it('unarchiveNode delegates to nodesService.unarchive', () => {
    resolver.unarchiveNode('1');
    expect(nodesService.unarchive).toHaveBeenCalledWith('1');
  });
});
