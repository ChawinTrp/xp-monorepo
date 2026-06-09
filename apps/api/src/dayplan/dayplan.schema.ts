import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DayPlanDocument = DayPlan & Document;

@Schema({ timestamps: true })
@ObjectType()
export class DayPlan {
  @Field(() => ID)
  _id!: string;

  // "YYYY-MM-DD" — one plan record per date.
  @Prop({ required: true, unique: true, index: true })
  @Field(() => String)
  date!: string;

  // Node ids (TASK + ROUTINE) in manual queue order. May contain ids that
  // later complete or get deleted; readers filter against live nodes.
  @Prop({ type: [String], default: [] })
  @Field(() => [String])
  orderedIds!: string[];

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  updatedAt?: Date;
}

export const DayPlanSchema = SchemaFactory.createForClass(DayPlan);
