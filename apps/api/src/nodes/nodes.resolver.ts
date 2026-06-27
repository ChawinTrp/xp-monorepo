import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { NodesService } from './nodes.service';
import { PropagationService } from './propagation.service';
import { Node } from './node.entity';
import { CreateNodeInput } from './dto/create-node.input';
import { UpdateNodeInput } from './dto/update-node.input';
import { CompleteTaskInput } from './dto/complete-task.input';
import { WeekProgress } from './week-progress.types';

@Resolver(() => Node)
export class NodesResolver {
  constructor(
    private readonly nodesService: NodesService,
    private readonly propagationService: PropagationService,
  ) {}

  @Mutation(() => Node)
  createNode(@Args('createNodeInput') createNodeInput: CreateNodeInput) {
    return this.nodesService.create(createNodeInput);
  }

  @Query(() => [Node], { name: 'nodes' })
  findAll(
    @Args('includeArchived', { type: () => Boolean, nullable: true })
    includeArchived?: boolean,
  ) {
    return this.nodesService.findAll(includeArchived ?? false);
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
    @Args('includeArchived', { type: () => Boolean, nullable: true })
    includeArchived?: boolean,
  ) {
    return this.nodesService.searchNodes(
      term || '',
      allowedTypes,
      includeArchived ?? false,
    );
  }

  @Mutation(() => Node)
  deleteNode(@Args('id', { type: () => ID }) id: string) {
    return this.nodesService.remove(id);
  }

  @Mutation(() => Node)
  archiveNode(@Args('id', { type: () => ID }) id: string) {
    return this.nodesService.archive(id);
  }

  @Mutation(() => Node)
  unarchiveNode(@Args('id', { type: () => ID }) id: string) {
    return this.nodesService.unarchive(id);
  }

  @Mutation(() => [Node])
  completeTask(@Args('completeTaskInput') completeTaskInput: CompleteTaskInput) {
    return this.propagationService.onTaskCompleted(completeTaskInput);
  }

  @Mutation(() => [Node])
  checkInRoutine(@Args('id', { type: () => ID }) id: string) {
    return this.propagationService.checkInRoutine(id);
  }

  @Mutation(() => [Node])
  undoCheckInRoutine(@Args('id', { type: () => ID }) id: string) {
    return this.propagationService.undoCheckInRoutine(id);
  }

  @Mutation(() => [Node])
  reopenTask(@Args('id', { type: () => ID }) id: string) {
    return this.propagationService.reopenTask(id);
  }

  @Mutation(() => Node)
  startTaskTimer(@Args('id', { type: () => ID }) id: string) {
    return this.propagationService.startTimer(id);
  }

  @Mutation(() => Node)
  stopTaskTimer(@Args('id', { type: () => ID }) id: string) {
    return this.propagationService.stopTimer(id);
  }

  @Query(() => WeekProgress)
  async weekProgress(
    @Args('weekStart', { nullable: true }) weekStart?: string,
  ): Promise<WeekProgress> {
    return this.propagationService.getWeekProgress(weekStart);
  }
}
