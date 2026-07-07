import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Node, NodeSchema } from '../nodes/node.entity';
import { GCalState, GCalStateSchema } from './gcal-state.schema';
import { GCalService } from './gcal.service';
import { GCalController } from './gcal.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Node.name, schema: NodeSchema },
      { name: GCalState.name, schema: GCalStateSchema },
    ]),
  ],
  controllers: [GCalController],
  providers: [GCalService],
  exports: [GCalService],
})
export class GCalModule {}
