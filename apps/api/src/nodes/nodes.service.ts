import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Node, NodeDocument } from './node.entity';
import { CreateNodeInput } from './dto/create-node.input';
import { UpdateNodeInput } from './dto/update-node.input';

@Injectable()
export class NodesService {
  constructor(@InjectModel(Node.name) private nodeModel: Model<NodeDocument>) {}

  async create(input: CreateNodeInput): Promise<Node> {
    const node = await new this.nodeModel(input).save();

    await this.addToParentChildren(node._id.toString(), node.mainParent, input.parents);

    return node;
  }

  async findAll(): Promise<Node[]> {
    return this.nodeModel.find().exec();
  }

  async findOne(id: string): Promise<Node> {
    const node = await this.nodeModel.findById(id).exec();
    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }
    return node;
  }

  async searchNodes(term: string, allowedTypes?: string[]): Promise<Node[]> {
    const query: Record<string, unknown> = {};

    if (term) {
      query.title = { $regex: term, $options: 'i' };
    }

    if (allowedTypes && allowedTypes.length > 0) {
      query.type = { $in: allowedTypes };
    }

    return this.nodeModel.find(query).limit(20).exec();
  }

  async update(id: string, input: UpdateNodeInput): Promise<Node> {
    const oldNode = await this.nodeModel.findById(id).exec();
    if (!oldNode) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    const oldParentIds = this.collectParentIds(oldNode.mainParent?.toString(), oldNode.parents?.map(String));
    const newParentIds = this.collectParentIds(input.mainParent, input.parents);

    const updatedNode = await this.nodeModel
      .findByIdAndUpdate(id, input, { returnDocument: 'after' })
      .exec();

    if (!updatedNode) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    // Only re-sync parent children if parents actually changed
    if (input.mainParent !== undefined || input.parents !== undefined) {
      const removed = oldParentIds.filter((p) => !newParentIds.includes(p));
      const added = newParentIds.filter((p) => !oldParentIds.includes(p));

      if (removed.length > 0) {
        await this.nodeModel.updateMany(
          { _id: { $in: removed } },
          { $pull: { children: id } },
        );
      }

      if (added.length > 0) {
        await this.nodeModel.updateMany(
          { _id: { $in: added } },
          { $addToSet: { children: id } },
        );
      }
    }

    return updatedNode;
  }

  async remove(id: string): Promise<Node> {
    const node = await this.nodeModel.findById(id).exec();
    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    // Remove this node from all parents' children arrays
    const parentIds = this.collectParentIds(node.mainParent?.toString(), node.parents?.map(String));
    if (parentIds.length > 0) {
      await this.nodeModel.updateMany(
        { _id: { $in: parentIds } },
        { $pull: { children: id } },
      );
    }

    // Clear mainParent on orphaned children
    if (node.children && node.children.length > 0) {
      await this.nodeModel.updateMany(
        { _id: { $in: node.children }, mainParent: id },
        { $unset: { mainParent: '' } },
      );
      // Also remove this node from children's parents arrays
      await this.nodeModel.updateMany(
        { _id: { $in: node.children } },
        { $pull: { parents: id } },
      );
    }

    await this.nodeModel.findByIdAndDelete(id).exec();

    return node;
  }

  private async addToParentChildren(
    childId: string,
    mainParent?: string,
    parents?: string[],
  ): Promise<void> {
    const parentIds = this.collectParentIds(mainParent, parents);
    if (parentIds.length === 0) return;

    await this.nodeModel.updateMany(
      { _id: { $in: parentIds } },
      { $addToSet: { children: childId } },
    );
  }

  private collectParentIds(mainParent?: string, parents?: string[]): string[] {
    const ids = new Set<string>();
    if (mainParent) ids.add(mainParent);
    if (parents) parents.forEach((p) => ids.add(p));
    return [...ids];
  }
}
