import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Node, NodeSchema } from '../nodes/node.entity';
import { GCalService } from './gcal.service';
import { GCalController } from './gcal.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Node.name, schema: NodeSchema }]),
  ],
  controllers: [GCalController],
  providers: [GCalService],
  exports: [GCalService],
})
export class GCalModule {}
