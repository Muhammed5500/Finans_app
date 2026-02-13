import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * TagsRepository
 *
 * Data access layer for tags.
 */
@Injectable()
export class TagsRepository {
  private readonly logger = new Logger(TagsRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find tag by name
   */
  async findByName(name: string) {
    return this.prisma.tag.findUnique({
      where: { name: name.toLowerCase() },
    });
  }

  /**
   * Find or create a tag
   */
  async upsert(name: string) {
    return this.prisma.tag.upsert({
      where: { name: name.toLowerCase() },
      create: { name: name.toLowerCase() },
      update: {},
    });
  }

  /**
   * Find tags with filters and counts
   */
  async findWithFilters(params: {
    skip?: number;
    take?: number;
    search?: string;
  }): Promise<{ items: any[]; total: number }> {
    const where: Prisma.TagWhereInput = {};

    if (params.search) {
      where.name = {
        contains: params.search.toLowerCase(),
        mode: 'insensitive',
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.tag.findMany({
        skip: params.skip,
        take: params.take,
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { newsItems: true },
          },
        },
      }),
      this.prisma.tag.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get all tags
   */
  async findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { newsItems: true },
        },
      },
    });
  }
}
