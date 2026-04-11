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

  // 🌟 NEW: Search Nodes for lazy-loaded Comboboxes
  async searchNodes(term: string, allowedTypes?: string[]): Promise<Node[]> {
    const query: any = {};

    if (term) {
      // Use MongoDB regex for partial, case-insensitive matching
      query.title = { $regex: term, $options: 'i' };
    }

    if (allowedTypes && allowedTypes.length > 0) {
      // Only return nodes that match the allowed types (Contextual Filtering)
      query.type = { $in: allowedTypes };
    }

    // Limit results to 20 to keep the UI fast and prevent massive payloads
    return this.nodeModel.find(query).limit(20).exec();
  }

  // 🌟 NEW: Update a Node by ID with error handling
  async update(id: string, updateNodeInput: UpdateNodeInput): Promise<Node> {
    const updatedNode = await this.nodeModel
      .findByIdAndUpdate(id, updateNodeInput, { returnDocument: 'after' })
      .exec();

    if (!updatedNode) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }
    return updatedNode;
  }
  // 🌟 NEW: Delete a Node by ID
  async remove(id: string): Promise<Node> {
    const deletedNode = await this.nodeModel.findByIdAndDelete(id).exec();

    if (!deletedNode) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }
    return deletedNode;
  }
}
