import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class DayWin {
  @Field() date: string;
  @Field() won: boolean;
  @Field(() => Int) routinesCheckedIn: number;
  @Field(() => Int) routineTarget: number;
  @Field(() => Int) tasksCompleted: number;
  @Field(() => Int) taskTarget: number;
}

@ObjectType()
export class WeekProgress {
  @Field() weekStart: string;
  @Field(() => [DayWin]) days: DayWin[];
  @Field(() => Int) wonDays: number;
  @Field(() => Int) weekTarget: number;
  @Field() weekWon: boolean;
  @Field(() => Int) weekWinStreak: number;
}
