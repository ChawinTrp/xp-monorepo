import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { DayPlan } from './dayplan.schema';
import { DayPlanService } from './dayplan.service';
import { UpsertDayPlanInput } from './dto/upsert-dayplan.input';

@Resolver(() => DayPlan)
export class DayPlanResolver {
  constructor(private readonly dayPlanService: DayPlanService) {}

  @Query(() => DayPlan, { name: 'dayPlan', nullable: true })
  dayPlan(@Args('date', { type: () => String }) date: string) {
    return this.dayPlanService.findByDate(date);
  }

  @Mutation(() => DayPlan)
  upsertDayPlan(@Args('input') input: UpsertDayPlanInput) {
    return this.dayPlanService.upsert(input);
  }
}
