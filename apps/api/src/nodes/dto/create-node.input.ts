import { InputType, Field, ID, Float } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateNodeInput {
  @Field(() => String)
  title!: string;

  @Field(() => String)
  type!: string;

  @Field(() => String, { nullable: true })
  description?: string;

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

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>;
}
