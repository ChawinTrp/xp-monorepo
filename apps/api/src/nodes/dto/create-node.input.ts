import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateNodeInput {
  @Field(() => String)
  title: string;

  @Field(() => String)
  type: string;

  @Field(() => String, { nullable: true })
  content?: string;
}
