import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import { CreateNodeInput } from './create-node.input';

@InputType()
export class UpdateNodeInput extends PartialType(CreateNodeInput) {
  @Field(() => ID)
  _id!: string;
}
