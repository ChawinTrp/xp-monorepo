import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import { CreateNodeInput } from './create-node.input';

// PartialType automatically makes title, type, and content optional
// so we don't have to send all of them if we are only updating one thing!
@InputType()
export class UpdateNodeInput extends PartialType(CreateNodeInput) {
  @Field(() => ID)
  _id!: string;
}
