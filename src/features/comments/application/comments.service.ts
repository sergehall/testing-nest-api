import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto } from '../../common/pagination/dto/pagination.dto';
import { Pagination } from '../../common/pagination/pagination';
import { CommentsRepository } from '../infrastructure/comments.repository';
import { PostsService } from '../../posts/application/posts.service';
import { CommentsEntity } from '../entities/comments.entity';
import { FilteringCommentsNoBannedUserCommand } from '../../users/application/use-cases/filtering-comments-noBannedUser.use-case';
import { CommandBus } from '@nestjs/cqrs';
import { FillingCommentsDataCommand } from './use-cases/filling-comments-data.use-case';
import { CurrentUserDto } from '../../users/dto/currentUser.dto';

@Injectable()
export class CommentsService {
  constructor(
    protected pagination: Pagination,
    protected commentsRepository: CommentsRepository,
    protected postsService: PostsService,
    protected commandBus: CommandBus,
  ) {}

  async findCommentById(
    commentId: string,
    currentUserDto: CurrentUserDto | null,
  ) {
    const comment = await this.commentsRepository.findCommentById(commentId);
    if (!comment) throw new NotFoundException();
    const commentNotBannedUser = await this.commandBus.execute(
      new FilteringCommentsNoBannedUserCommand([comment]),
    );
    if (commentNotBannedUser.length === 0) throw new NotFoundException();
    const filledComments = await this.commandBus.execute(
      new FillingCommentsDataCommand(commentNotBannedUser, currentUserDto),
    );
    return filledComments[0];
  }

  async findCommentsByPostId(
    queryPagination: PaginationDto,
    postId: string,
    currentUserDto: CurrentUserDto | null,
  ) {
    const post = await this.postsService.checkPostInDB(postId);
    if (!post) throw new NotFoundException();
    const comments = await this.commentsRepository.findCommentsByPostId(postId);
    if (!comments || comments.length === 0) {
      return {
        pagesCount: 1,
        page: 1,
        pageSize: 10,
        totalCount: 0,
        items: [],
      };
    }
    const commentsNotBannedUser = await this.commandBus.execute(
      new FilteringCommentsNoBannedUserCommand(comments),
    );
    let desc = 1;
    let asc = -1;
    const field: 'content' | 'createdAt' =
      queryPagination.sortBy === 'content'
        ? queryPagination.sortBy
        : 'createdAt';
    if (
      queryPagination.sortDirection === 'asc' ||
      queryPagination.sortDirection === 'ascending' ||
      queryPagination.sortDirection === 1
    ) {
      desc = -1;
      asc = 1;
    }
    const totalCount = commentsNotBannedUser.length;
    const allComments = commentsNotBannedUser.sort(
      await byField(field, asc, desc),
    );

    async function byField(
      field: 'content' | 'createdAt',
      asc: number,
      desc: number,
    ) {
      return (a: CommentsEntity, b: CommentsEntity) =>
        a[field] > b[field] ? asc : desc;
    }
    const startIndex =
      (queryPagination.pageNumber - 1) * queryPagination.pageSize;
    const pagesCount = Math.ceil(totalCount / queryPagination.pageSize);

    const commentsSlice = allComments.slice(
      startIndex,
      startIndex + queryPagination.pageSize,
    );
    const filledComments = await this.commandBus.execute(
      new FillingCommentsDataCommand(commentsSlice, currentUserDto),
    );

    return {
      pagesCount: pagesCount,
      page: queryPagination.pageNumber,
      pageSize: queryPagination.pageSize,
      totalCount: totalCount,
      items: filledComments,
    };
  }
}
