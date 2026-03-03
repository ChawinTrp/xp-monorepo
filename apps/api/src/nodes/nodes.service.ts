import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Node, NodeDocument } from './node.entity';
import { CreateNodeInput } from './dto/create-node.input';

@Injectable()
export class NodesService {
  constructor(@InjectModel(Node.name) private nodeModel: Model<NodeDocument>) {}

  async create(createNodeInput: CreateNodeInput): Promise<Node> {
    const createdNode = new this.nodeModel(createNodeInput);
    return createdNode.save();
  }

  async findAll(): Promise<Node[]> {
    return this.nodeModel.find().exec();
  }
}
