import { InputType, Field, ID, Float } from '@nestjs/graphql';

@InputType()
export class CreateNodeInput {
  // Strict mode assertions aligned
  @Field(() => String)
  title!: string;

  @Field(() => String)
  type!: string;

  @Field(() => String, { nullable: true })
  content?: string;

  // --- NEW GRAPH FIELDS ---
  @Field(() => ID, { nullable: true })
  mainParent?: string;

  @Field(() => [ID], { nullable: 'itemsAndList' })
  parents?: string[];

  @Field(() => [ID], { nullable: 'itemsAndList' })
  children?: string[];

  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => Float, { nullable: true })
  progress?: number;
}
