import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DayPlan, DayPlanSchema } from './dayplan.schema';
import { DayPlanService } from './dayplan.service';
import { DayPlanResolver } from './dayplan.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DayPlan.name, schema: DayPlanSchema }]),
  ],
  providers: [DayPlanService, DayPlanResolver],
})
export class DayPlanModule {}
