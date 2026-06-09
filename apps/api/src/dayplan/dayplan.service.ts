import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DayPlan, DayPlanDocument } from './dayplan.schema';
import { UpsertDayPlanInput } from './dto/upsert-dayplan.input';

@Injectable()
export class DayPlanService {
  constructor(
    @InjectModel(DayPlan.name) private dayPlanModel: Model<DayPlanDocument>,
  ) {}

  async findByDate(date: string): Promise<DayPlan | null> {
    return this.dayPlanModel.findOne({ date }).exec();
  }

  async upsert(input: UpsertDayPlanInput): Promise<DayPlan> {
    return this.dayPlanModel
      .findOneAndUpdate(
        { date: input.date },
        { $set: { orderedIds: input.orderedIds } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec() as Promise<DayPlan>;
  }
}
