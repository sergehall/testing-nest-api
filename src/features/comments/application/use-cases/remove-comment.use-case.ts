import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ForbiddenError } from '@casl/ability';
import { Action } from '../../../../ability/roles/action.enum';
import { CommentsRepository } from '../../infrastructure/comments.repository';
import { CaslAbilityFactory } from '../../../../ability/casl-ability.factory';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CurrentUserDto } from '../../../users/dto/currentUser.dto';

export class RemoveCommentCommand {
  constructor(
    public commentId: string,
    public currentUserDto: CurrentUserDto,
  ) {}
}

@CommandHandler(RemoveCommentCommand)
export class RemoveCommentUseCase
  implements ICommandHandler<RemoveCommentCommand>
{
  constructor(
    protected commentsRepository: CommentsRepository,
    protected caslAbilityFactory: CaslAbilityFactory,
  ) {}
  async execute(command: RemoveCommentCommand) {
    const findComment = await this.commentsRepository.findCommentById(
      command.commentId,
    );
    if (!findComment) throw new NotFoundException();
    try {
      const ability = this.caslAbilityFactory.createForUserId({
        id: command.currentUserDto.id,
      });
      ForbiddenError.from(ability).throwUnlessCan(Action.DELETE, {
        id: findComment.commentatorInfo.userId,
      });
      return this.commentsRepository.removeComment(command.commentId);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw new ForbiddenException(error.message);
      }
    }
  }
}
