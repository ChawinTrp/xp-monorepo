import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpsertDayPlanInput {
  @Field(() => String)
  date!: string;

  @Field(() => [String])
  orderedIds!: string[];
}
