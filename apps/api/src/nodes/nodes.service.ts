import { Injectable, NotFoundException } from '@nestjs/common'; // 🌟 Added NotFoundException
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Node, NodeDocument } from './node.entity';
import { CreateNodeInput } from './dto/create-node.input';
import { UpdateNodeInput } from './dto/update-node.input';

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

  // 🌟 NEW: Fetch a single Node by ID with error handling
  async findOne(id: string): Promise<Node> {
    const node = await this.nodeModel.findById(id).exec();
    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }
    return node;
  }

  // 🌟 NEW: Update a Node by ID with error handling
  async update(id: string, updateNodeInput: UpdateNodeInput): Promise<Node> {
    // { new: true } tells Mongoose to return the updated object instead of the old one
    const updatedNode = await this.nodeModel
      .findByIdAndUpdate(id, updateNodeInput, { returnDocument: 'after' })
      .exec();

    if (!updatedNode) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }
    return updatedNode;
  }
}
