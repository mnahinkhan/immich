import { LibraryType, UserEntity } from '@app/infra/entities';
import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

import { ILibraryRepository } from '@app/infra/repositories';
import { LibraryResponseDto, mapLibrary } from '.';
import { AuthUserDto } from '..';
import { AccessCore, IAccessRepository, Permission } from '../access';
import { IJobRepository, ILibraryJob, JobName } from '../job';
import { CreateLibraryDto } from './dto/create-library.dto';
import { GetLibrariesDto } from './dto/get-libraries-dto';
import { ScanLibraryDto } from './dto/scan-library-dto';
import { LibraryCrawler } from './library-crawler';

@Injectable()
export class LibraryService {
  readonly logger = new Logger(LibraryService.name);
  private access: AccessCore;
  private readonly crawler: LibraryCrawler;

  constructor(
    @Inject(ILibraryRepository) private libraryRepository: ILibraryRepository,
    @Inject(IAccessRepository) accessRepository: IAccessRepository,
    @Inject(IJobRepository) private jobRepository: IJobRepository,
  ) {
    this.access = new AccessCore(accessRepository);
    this.crawler = new LibraryCrawler();
  }

  async getCount(authUser: AuthUserDto): Promise<number> {
    return this.libraryRepository.getCountForUser(authUser.id);
  }

  public async createLibrary(authUser: AuthUserDto, dto: CreateLibraryDto): Promise<LibraryResponseDto> {
    const libraryEntity = await this.libraryRepository.create({
      owner: { id: authUser.id } as UserEntity,
      name: dto.name,
      assets: [],
      type: dto.libraryType,
      importPaths: [],
      isVisible: dto.isVisible ?? true,
    });
    return mapLibrary(libraryEntity);
  }

  public async getAll(authUser: AuthUserDto, dto: GetLibrariesDto): Promise<LibraryResponseDto[]> {
    if (dto.assetId) {
      // TODO
      throw new BadRequestException('Not implemented yet');
    }
    const libraries = await this.libraryRepository.getAllByUserId(authUser.id, dto);
    return libraries.map((library) => mapLibrary(library));
  }

  public async getLibraryById(authUser: AuthUserDto, libraryId: string): Promise<LibraryResponseDto> {
    await this.access.requirePermission(authUser, Permission.LIBRARY_READ, libraryId);

    const libraryEntity = await this.libraryRepository.getById(libraryId);
    return mapLibrary(libraryEntity);
  }

  public async scanLibrary(authUser: AuthUserDto, scanLibraryDto: ScanLibraryDto) {
    // TODO:
    //await this.access.requirePermission(authUser, Permission.LIBRARY_UPDATE, dto.libraryId);

    const libraryEntity = await this.libraryRepository.getById(scanLibraryDto.libraryId);

    if (libraryEntity.type != LibraryType.IMPORT) {
      Logger.error('Only imported libraries can be refreshed');
      throw new InternalServerErrorException('Only imported libraries can be refreshed');
    }

    if (!libraryEntity.importPaths) {
      // No paths to crawl
      return;
    }

    const crawledAssetPaths = await this.crawler.findAllMedia({
      pathsToCrawl: libraryEntity.importPaths,
      excludePatterns: ['**/Original/**'],
    });
    for (const assetPath of crawledAssetPaths) {
      const libraryJobData: ILibraryJob = {
        assetPath: assetPath,
        ownerId: authUser.id,
        libraryId: scanLibraryDto.libraryId,
      };

      await this.jobRepository.queue({
        name: JobName.ADD_LIBRARY_FILE,
        data: libraryJobData,
      });
    }
  }
}
