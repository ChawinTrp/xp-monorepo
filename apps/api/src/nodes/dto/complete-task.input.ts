import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class CompleteTaskInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  completedDate?: string;
}
