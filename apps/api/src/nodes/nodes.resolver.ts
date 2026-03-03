import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { NodesService } from './nodes.service';
import { Node } from './node.entity';
import { CreateNodeInput } from './dto/create-node.input';

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
}
