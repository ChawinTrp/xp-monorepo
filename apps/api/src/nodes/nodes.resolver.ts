import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { NodesService } from './nodes.service';
import { Node } from './node.entity';
import { CreateNodeInput } from './dto/create-node.input';
import { UpdateNodeInput } from './dto/update-node.input';

@Resolver(() => Node)
export class NodesResolver {
  constructor(private readonly nodesService: NodesService) {}

  @Mutation(() => Node)
  createNode(@Args('createNodeInput') createNodeInput: CreateNodeInput) {
    return this.nodesService.create(createNodeInput);
  }

  @Query(() => [Node], { name: 'nodes' })
  findAll() {
    return this.nodesService.findAll();
  }

  @Query(() => Node, { name: 'node' })
  findOne(@Args('id', { type: () => String }) id: string) {
    return this.nodesService.findOne(id);
  }

  @Mutation(() => Node)
  updateNode(@Args('updateNodeInput') updateNodeInput: UpdateNodeInput) {
    return this.nodesService.update(updateNodeInput._id, updateNodeInput);
  }

  @Query(() => [Node], { name: 'searchNodes' })
  searchNodes(
    @Args('term', { type: () => String, nullable: true }) term?: string,
    @Args('allowedTypes', { type: () => [String], nullable: 'itemsAndList' })
    allowedTypes?: string[],
  ) {
    return this.nodesService.searchNodes(term || '', allowedTypes);
  }

  @Mutation(() => Node)
  deleteNode(@Args('id', { type: () => ID }) id: string) {
    return this.nodesService.remove(id);
  }
}
