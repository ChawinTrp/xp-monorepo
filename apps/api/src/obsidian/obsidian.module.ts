import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Node, NodeSchema } from '../nodes/node.entity';
import { ObsidianSyncService } from './obsidian-sync.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Node.name, schema: NodeSchema }])],
  providers: [ObsidianSyncService],
  exports: [ObsidianSyncService],
})
export class ObsidianModule {}
