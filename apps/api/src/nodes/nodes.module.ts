import { Module } from '@nestjs/common';
import { NodesService } from './nodes.service';
import { NodesResolver } from './nodes.resolver';
import { PropagationService } from './propagation.service';
import { Node, NodeSchema } from './node.entity';
import { GCalModule } from '../gcal/gcal.module';

import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Node.name, schema: NodeSchema }]),
    GCalModule,
  ],
  providers: [NodesService, NodesResolver, PropagationService],
})
export class NodesModule {}
