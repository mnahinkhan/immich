import {
  AuthUserDto,
  CreateLibraryDto,
  GetLibrariesDto,
  LibraryResponseDto,
  LibraryService,
  ScanLibraryDto as RefreshLibraryDto,
  SetImportPathsDto,
} from '@app/domain';
import { Body, ConsoleLogger, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminRoute, Authenticated, AuthUser } from '../app.guard';
import { UseValidation } from '../app.utils';
import { UUIDParamDto } from './dto/uuid-param.dto';

@ApiTags('Library')
@Controller('library')
@Authenticated()
@UseValidation()
export class LibraryController {
  constructor(private libraryService: LibraryService) {}

  @AdminRoute()
  @Post()
  createLibrary(
    @AuthUser() authUser: AuthUserDto,
    @Body() createLibraryDto: CreateLibraryDto,
  ): Promise<LibraryResponseDto> {
    return this.libraryService.create(authUser, createLibraryDto);
  }

  @Get()
  getAllLibraries(@AuthUser() authUser: AuthUserDto, @Query() dto: GetLibrariesDto): Promise<LibraryResponseDto[]> {
    return this.libraryService.getAll(authUser, dto);
  }

  @Get('count')
  getLibraryCount(@AuthUser() authUser: AuthUserDto): Promise<number> {
    return this.libraryService.getCount(authUser);
  }

  @Get(':id')
  getLibraryInfo(@AuthUser() authUser: AuthUserDto, @Param() { id }: UUIDParamDto): Promise<LibraryResponseDto> {
    return this.libraryService.get(authUser, id);
  }

  @Get(':id/importPaths')
  getImportPaths(@AuthUser() authUser: AuthUserDto, @Param() { id }: UUIDParamDto): Promise<string[]> {
    return this.libraryService.getImportPaths(authUser, id);
  }

  @Post(':id/importPaths')
  setImportPaths(@AuthUser() authUser: AuthUserDto, @Param() { id }: UUIDParamDto, @Body() dto: SetImportPathsDto) {
    return this.libraryService.setImportPaths(authUser, id, dto);
  }

  @Post('refresh/:id')
  refreshLibrary(@AuthUser() authUser: AuthUserDto, @Param() { id }: UUIDParamDto, @Body() dto: RefreshLibraryDto) {
    return this.libraryService.refresh(authUser, id, dto);
  }
}
