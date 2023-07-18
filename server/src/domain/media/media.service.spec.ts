import { AssetType, SystemConfigKey, TranscodeHWAccel, TranscodePolicy, VideoCodec } from '@app/infra/entities';
import {
  assetEntityStub,
  newAssetRepositoryMock,
  newJobRepositoryMock,
  newMediaRepositoryMock,
  newStorageRepositoryMock,
  newSystemConfigRepositoryMock,
  probeStub,
} from '@test';
import { IAssetRepository, WithoutProperty } from '../asset';
import { IJobRepository, JobName } from '../job';
import { IStorageRepository } from '../storage';
import { ISystemConfigRepository } from '../system-config';
import { IMediaRepository } from './media.repository';
import { MediaService } from './media.service';

describe(MediaService.name, () => {
  let sut: MediaService;
  let assetMock: jest.Mocked<IAssetRepository>;
  let configMock: jest.Mocked<ISystemConfigRepository>;
  let jobMock: jest.Mocked<IJobRepository>;
  let mediaMock: jest.Mocked<IMediaRepository>;
  let storageMock: jest.Mocked<IStorageRepository>;

  beforeEach(async () => {
    assetMock = newAssetRepositoryMock();
    configMock = newSystemConfigRepositoryMock();
    jobMock = newJobRepositoryMock();
    mediaMock = newMediaRepositoryMock();
    storageMock = newStorageRepositoryMock();

    sut = new MediaService(assetMock, jobMock, mediaMock, storageMock, configMock);
  });

  it('should be defined', () => {
    expect(sut).toBeDefined();
  });

  describe('handleQueueGenerateThumbnails', () => {
    it('should queue all assets', async () => {
      assetMock.getAll.mockResolvedValue({
        items: [assetEntityStub.image],
        hasNextPage: false,
      });

      await sut.handleQueueGenerateThumbnails({ force: true });

      expect(assetMock.getAll).toHaveBeenCalled();
      expect(assetMock.getWithout).not.toHaveBeenCalled();
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.GENERATE_JPEG_THUMBNAIL,
        data: { id: assetEntityStub.image.id },
      });
    });

    it('should queue all assets with missing resize path', async () => {
      assetMock.getWithout.mockResolvedValue({
        items: [assetEntityStub.noResizePath],
        hasNextPage: false,
      });

      await sut.handleQueueGenerateThumbnails({ force: false });

      expect(assetMock.getAll).not.toHaveBeenCalled();
      expect(assetMock.getWithout).toHaveBeenCalledWith({ skip: 0, take: 1000 }, WithoutProperty.THUMBNAIL);
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.GENERATE_JPEG_THUMBNAIL,
        data: { id: assetEntityStub.image.id },
      });
    });

    it('should queue all assets with missing webp path', async () => {
      assetMock.getWithout.mockResolvedValue({
        items: [assetEntityStub.noWebpPath],
        hasNextPage: false,
      });

      await sut.handleQueueGenerateThumbnails({ force: false });

      expect(assetMock.getAll).not.toHaveBeenCalled();
      expect(assetMock.getWithout).toHaveBeenCalledWith({ skip: 0, take: 1000 }, WithoutProperty.THUMBNAIL);
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.GENERATE_WEBP_THUMBNAIL,
        data: { id: assetEntityStub.image.id },
      });
    });

    it('should queue all assets with missing thumbhash', async () => {
      assetMock.getWithout.mockResolvedValue({
        items: [assetEntityStub.noThumbhash],
        hasNextPage: false,
      });

      await sut.handleQueueGenerateThumbnails({ force: false });

      expect(assetMock.getAll).not.toHaveBeenCalled();
      expect(assetMock.getWithout).toHaveBeenCalledWith({ skip: 0, take: 1000 }, WithoutProperty.THUMBNAIL);
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.GENERATE_THUMBHASH_THUMBNAIL,
        data: { id: assetEntityStub.image.id },
      });
    });
  });

  describe('handleGenerateJpegThumbnail', () => {
    it('should skip thumbnail generation if asset not found', async () => {
      assetMock.getByIds.mockResolvedValue([]);
      await sut.handleGenerateJpegThumbnail({ id: assetEntityStub.image.id });
      expect(mediaMock.resize).not.toHaveBeenCalled();
      expect(assetMock.save).not.toHaveBeenCalledWith();
    });

    it('should generate a thumbnail for an image', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.image]);
      await sut.handleGenerateJpegThumbnail({ id: assetEntityStub.image.id });

      expect(storageMock.mkdirSync).toHaveBeenCalledWith('upload/thumbs/user-id');
      expect(mediaMock.resize).toHaveBeenCalledWith('/original/path.jpg', 'upload/thumbs/user-id/asset-id.jpeg', {
        size: 1440,
        format: 'jpeg',
      });
      expect(assetMock.save).toHaveBeenCalledWith({
        id: 'asset-id',
        resizePath: 'upload/thumbs/user-id/asset-id.jpeg',
      });
    });

    it('should generate a thumbnail for a video', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleGenerateJpegThumbnail({ id: assetEntityStub.video.id });

      expect(storageMock.mkdirSync).toHaveBeenCalledWith('upload/thumbs/user-id');
      expect(mediaMock.extractVideoThumbnail).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/thumbs/user-id/asset-id.jpeg',
        1440,
      );
      expect(assetMock.save).toHaveBeenCalledWith({
        id: 'asset-id',
        resizePath: 'upload/thumbs/user-id/asset-id.jpeg',
      });
    });

    it('should run successfully', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.image]);
      await sut.handleGenerateJpegThumbnail({ id: assetEntityStub.image.id });
    });
  });

  describe('handleGenerateWebpThumbnail', () => {
    it('should skip thumbnail generation if asset not found', async () => {
      assetMock.getByIds.mockResolvedValue([]);
      await sut.handleGenerateWebpThumbnail({ id: assetEntityStub.image.id });
      expect(mediaMock.resize).not.toHaveBeenCalled();
      expect(assetMock.save).not.toHaveBeenCalledWith();
    });

    it('should skip thumbnail generate if resize path is missing', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.noResizePath]);
      await sut.handleGenerateWebpThumbnail({ id: assetEntityStub.noResizePath.id });
      expect(mediaMock.resize).not.toHaveBeenCalled();
    });

    it('should generate a thumbnail', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.image]);
      await sut.handleGenerateWebpThumbnail({ id: assetEntityStub.image.id });

      expect(mediaMock.resize).toHaveBeenCalledWith(
        '/uploads/user-id/thumbs/path.jpg',
        '/uploads/user-id/thumbs/path.webp',
        { format: 'webp', size: 250 },
      );
      expect(assetMock.save).toHaveBeenCalledWith({ id: 'asset-id', webpPath: '/uploads/user-id/thumbs/path.webp' });
    });
  });

  describe('handleGenerateThumbhashThumbnail', () => {
    it('should skip thumbhash generation if asset not found', async () => {
      assetMock.getByIds.mockResolvedValue([]);
      await sut.handleGenerateThumbhashThumbnail({ id: assetEntityStub.image.id });
      expect(mediaMock.generateThumbhash).not.toHaveBeenCalled();
    });

    it('should skip thumbhash generation if resize path is missing', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.noResizePath]);
      await sut.handleGenerateThumbhashThumbnail({ id: assetEntityStub.noResizePath.id });
      expect(mediaMock.generateThumbhash).not.toHaveBeenCalled();
    });

    it('should generate a thumbhash', async () => {
      const thumbhashBuffer = Buffer.from('a thumbhash', 'utf8');
      assetMock.getByIds.mockResolvedValue([assetEntityStub.image]);
      mediaMock.generateThumbhash.mockResolvedValue(thumbhashBuffer);

      await sut.handleGenerateThumbhashThumbnail({ id: assetEntityStub.image.id });

      expect(mediaMock.generateThumbhash).toHaveBeenCalledWith('/uploads/user-id/thumbs/path.jpg');
      expect(assetMock.save).toHaveBeenCalledWith({ id: 'asset-id', thumbhash: thumbhashBuffer });
    });
  });

  describe('handleQueueVideoConversion', () => {
    it('should queue all video assets', async () => {
      assetMock.getAll.mockResolvedValue({
        items: [assetEntityStub.video],
        hasNextPage: false,
      });

      await sut.handleQueueVideoConversion({ force: true });

      expect(assetMock.getAll).toHaveBeenCalledWith({ skip: 0, take: 1000 }, { type: AssetType.VIDEO });
      expect(assetMock.getWithout).not.toHaveBeenCalled();
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.VIDEO_CONVERSION,
        data: { id: assetEntityStub.video.id },
      });
    });

    it('should queue all video assets without encoded videos', async () => {
      assetMock.getWithout.mockResolvedValue({
        items: [assetEntityStub.video],
        hasNextPage: false,
      });

      await sut.handleQueueVideoConversion({});

      expect(assetMock.getAll).not.toHaveBeenCalled();
      expect(assetMock.getWithout).toHaveBeenCalledWith({ skip: 0, take: 1000 }, WithoutProperty.ENCODED_VIDEO);
      expect(jobMock.queue).toHaveBeenCalledWith({
        name: JobName.VIDEO_CONVERSION,
        data: { id: assetEntityStub.video.id },
      });
    });
  });

  describe('handleVideoConversion', () => {
    beforeEach(() => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
    });

    it('should skip transcoding if asset not found', async () => {
      assetMock.getByIds.mockResolvedValue([]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.probe).not.toHaveBeenCalled();
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should skip transcoding if non-video asset', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.image]);
      await sut.handleVideoConversion({ id: assetEntityStub.image.id });
      expect(mediaMock.probe).not.toHaveBeenCalled();
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should transcode the longest stream', async () => {
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      mediaMock.probe.mockResolvedValue(probeStub.multipleVideoStreams);

      await sut.handleVideoConversion({ id: assetEntityStub.video.id });

      expect(mediaMock.probe).toHaveBeenCalledWith('/original/path.ext');
      expect(configMock.load).toHaveBeenCalled();
      expect(storageMock.mkdirSync).toHaveBeenCalled();
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should skip a video without any streams', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.noVideoStreams);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should skip a video without any height', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.noHeight);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should transcode when set to all', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.multipleVideoStreams);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: TranscodePolicy.ALL }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode when optimal and too big', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.videoStream2160p);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: TranscodePolicy.OPTIMAL }]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should not scale resolution if no target resolution', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.videoStream2160p);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_TRANSCODE, value: TranscodePolicy.ALL },
        { key: SystemConfigKey.FFMPEG_TARGET_RESOLUTION, value: 'original' },
      ]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode with alternate scaling video is vertical', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.videoStreamVertical2160p);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: TranscodePolicy.OPTIMAL }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=720:-2',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode when audio doesnt match target', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.audioStreamMp3);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: TranscodePolicy.OPTIMAL }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode when container doesnt match target', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: TranscodePolicy.OPTIMAL }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should not transcode an invalid transcode value', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.videoStream2160p);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: 'invalid' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should not transcode if transcoding is disabled', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.videoStream2160p);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TRANSCODE, value: TranscodePolicy.DISABLED }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should not transcode if target codec is invalid', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.videoStream2160p);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: 'invalid' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should set max bitrate if above 0', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_MAX_BITRATE, value: '4500k' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
            '-maxrate 4500k',
            '-bufsize 9000k',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode in two passes for h264/h265 when enabled and max bitrate is above 0', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_MAX_BITRATE, value: '4500k' },
        { key: SystemConfigKey.FFMPEG_TWO_PASS, value: true },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-b:v 3104k',
            '-minrate 1552k',
            '-maxrate 4500k',
          ],
          twoPass: true,
        },
      );
    });

    it('should fallback to one pass for h264/h265 if two-pass is enabled but no max bitrate is set', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_TWO_PASS, value: true }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should transcode by bitrate in two passes for vp9 when two pass mode and max bitrate are enabled', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_MAX_BITRATE, value: '4500k' },
        { key: SystemConfigKey.FFMPEG_TWO_PASS, value: true },
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: VideoCodec.VP9 },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec vp9',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-cpu-used 5',
            '-row-mt 1',
            '-b:v 3104k',
            '-minrate 1552k',
            '-maxrate 4500k',
          ],
          twoPass: true,
        },
      );
    });

    it('should configure preset for vp9', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: VideoCodec.VP9 },
        { key: SystemConfigKey.FFMPEG_PRESET, value: 'slow' },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec vp9',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-cpu-used 2',
            '-row-mt 1',
            '-crf 23',
            '-b:v 0',
          ],
          twoPass: false,
        },
      );
    });

    it('should not configure preset for vp9 if invalid', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: VideoCodec.VP9 },
        { key: SystemConfigKey.FFMPEG_PRESET, value: 'invalid' },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec vp9',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-row-mt 1',
            '-crf 23',
            '-b:v 0',
          ],
          twoPass: false,
        },
      );
    });

    it('should configure threads if above 0', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: VideoCodec.VP9 },
        { key: SystemConfigKey.FFMPEG_THREADS, value: 2 },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec vp9',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-cpu-used 5',
            '-row-mt 1',
            '-threads 2',
            '-crf 23',
            '-b:v 0',
          ],
          twoPass: false,
        },
      );
    });

    it('should disable thread pooling for h264 if thread limit is above 0', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_THREADS, value: 2 }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-threads 2',
            '-x264-params "pools=none"',
            '-x264-params "frame-threads=2"',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should omit thread flags for h264 if thread limit is at or below 0', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_THREADS, value: 0 }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should disable thread pooling for hevc if thread limit is above 0', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_THREADS, value: 2 },
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: VideoCodec.HEVC },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec hevc',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-threads 2',
            '-x265-params "pools=none"',
            '-x265-params "frame-threads=2"',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should omit thread flags for hevc if thread limit is at or below 0', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_THREADS, value: 0 },
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: VideoCodec.HEVC },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec hevc',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should skip transcoding for audioless videos with optimal policy if video codec is correct', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.noAudioStreams);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: VideoCodec.HEVC },
        { key: SystemConfigKey.FFMPEG_TRANSCODE, value: TranscodePolicy.OPTIMAL },
        { key: SystemConfigKey.FFMPEG_TARGET_RESOLUTION, value: '1080p' },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should return false if hwaccel is enabled for an unsupported codec', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.NVENC },
        { key: SystemConfigKey.FFMPEG_TARGET_VIDEO_CODEC, value: VideoCodec.VP9 },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await expect(sut.handleVideoConversion({ id: assetEntityStub.video.id })).resolves.toEqual(false);
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should return false if hwaccel option is invalid', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_ACCEL, value: 'invalid' }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await expect(sut.handleVideoConversion({ id: assetEntityStub.video.id })).resolves.toEqual(false);
      expect(mediaMock.transcode).not.toHaveBeenCalled();
    });

    it('should set two pass options for nvenc when enabled', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.NVENC },
        { key: SystemConfigKey.FFMPEG_MAX_BITRATE, value: '10000k' },
        { key: SystemConfigKey.FFMPEG_TWO_PASS, value: true },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device cuda=cuda:0', '-filter_hw_device cuda'],
          outputOptions: [
            `-vcodec h264_nvenc`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-tune hq',
            '-qmin 0',
            '-g 250',
            '-bf 3',
            '-b_ref_mode middle',
            '-temporal-aq 1',
            '-rc-lookahead 20',
            '-i_qfactor 0.75',
            '-b_qfactor 1.1',
            '-vf hwupload_cuda,scale_cuda=-2:720',
            '-preset p1',
            '-b:v 6897k',
            '-maxrate 10000k',
            '-bufsize 6897k',
            '-multipass 2',
          ],
          twoPass: false,
        },
      );
    });

    it('should set vbr options for nvenc when max bitrate is enabled', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.NVENC },
        { key: SystemConfigKey.FFMPEG_MAX_BITRATE, value: '10000k' },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device cuda=cuda:0', '-filter_hw_device cuda'],
          outputOptions: [
            `-vcodec h264_nvenc`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-tune hq',
            '-qmin 0',
            '-g 250',
            '-bf 3',
            '-b_ref_mode middle',
            '-temporal-aq 1',
            '-rc-lookahead 20',
            '-i_qfactor 0.75',
            '-b_qfactor 1.1',
            '-vf hwupload_cuda,scale_cuda=-2:720',
            '-preset p1',
            '-cq:v 23',
            '-maxrate 10000k',
            '-bufsize 6897k',
          ],
          twoPass: false,
        },
      );
    });

    it('should set cq options for nvenc when max bitrate is disabled', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.NVENC }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device cuda=cuda:0', '-filter_hw_device cuda'],
          outputOptions: [
            `-vcodec h264_nvenc`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-tune hq',
            '-qmin 0',
            '-g 250',
            '-bf 3',
            '-b_ref_mode middle',
            '-temporal-aq 1',
            '-rc-lookahead 20',
            '-i_qfactor 0.75',
            '-b_qfactor 1.1',
            '-vf hwupload_cuda,scale_cuda=-2:720',
            '-preset p1',
            '-cq:v 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should omit preset for nvenc if invalid', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.NVENC },
        { key: SystemConfigKey.FFMPEG_PRESET, value: 'invalid' },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device cuda=cuda:0', '-filter_hw_device cuda'],
          outputOptions: [
            `-vcodec h264_nvenc`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-tune hq',
            '-qmin 0',
            '-g 250',
            '-bf 3',
            '-b_ref_mode middle',
            '-temporal-aq 1',
            '-rc-lookahead 20',
            '-i_qfactor 0.75',
            '-b_qfactor 1.1',
            '-vf hwupload_cuda,scale_cuda=-2:720',
            '-cq:v 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should ignore two pass for nvenc if max bitrate is disabled', async () => {
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.NVENC }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device cuda=cuda:0', '-filter_hw_device cuda'],
          outputOptions: [
            `-vcodec h264_nvenc`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-tune hq',
            '-qmin 0',
            '-g 250',
            '-bf 3',
            '-b_ref_mode middle',
            '-temporal-aq 1',
            '-rc-lookahead 20',
            '-i_qfactor 0.75',
            '-b_qfactor 1.1',
            '-vf hwupload_cuda,scale_cuda=-2:720',
            '-preset p1',
            '-cq:v 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should set options for qsv', async () => {
      storageMock.readdir.mockResolvedValue(['renderD128']);
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.QSV },
        { key: SystemConfigKey.FFMPEG_MAX_BITRATE, value: '10000k' },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device qsv=accel:/dev/dri/renderD128', '-filter_hw_device accel'],
          outputOptions: [
            `-vcodec h264_qsv`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf format=nv12,hwupload=extra_hw_frames=64,scale_qsv=-2:720',
            '-preset 7',
            '-global_quality 23',
            '-maxrate 10000k',
          ],
          twoPass: false,
        },
      );
    });

    it('should omit preset for qsv if invalid', async () => {
      storageMock.readdir.mockResolvedValue(['renderD128']);
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.QSV },
        { key: SystemConfigKey.FFMPEG_PRESET, value: 'invalid' },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device qsv=accel:/dev/dri/renderD128', '-filter_hw_device accel'],
          outputOptions: [
            `-vcodec h264_qsv`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf format=nv12,hwupload=extra_hw_frames=64,scale_qsv=-2:720',
            '-global_quality 23',
          ],
          twoPass: false,
        },
      );
    });

    it('should set vbr options for vaapi when max bitrate is enabled', async () => {
      storageMock.readdir.mockResolvedValue(['renderD128']);
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.VAAPI },
        { key: SystemConfigKey.FFMPEG_MAX_BITRATE, value: '10000k' },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device vaapi=accel:/dev/dri/renderD128', '-filter_hw_device accel'],
          outputOptions: [
            `-vcodec h264_vaapi`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf format=nv12,hwupload,scale_vaapi=-2:720',
            '-compression_level 7',
            '-b:v 6897k',
            '-maxrate 10000k',
            '-minrate 3448.5k',
            '-rc_mode 3',
          ],
          twoPass: false,
        },
      );
    });

    it('should set cq options for vaapi when max bitrate is disabled', async () => {
      storageMock.readdir.mockResolvedValue(['renderD128']);
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.VAAPI }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device vaapi=accel:/dev/dri/renderD128', '-filter_hw_device accel'],
          outputOptions: [
            `-vcodec h264_vaapi`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf format=nv12,hwupload,scale_vaapi=-2:720',
            '-compression_level 7',
            '-qp 23',
            '-global_quality 23',
            '-rc_mode 1',
          ],
          twoPass: false,
        },
      );
    });

    it('should omit preset for vaapi if invalid', async () => {
      storageMock.readdir.mockResolvedValue(['renderD128']);
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([
        { key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.VAAPI },
        { key: SystemConfigKey.FFMPEG_PRESET, value: 'invalid' },
      ]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device vaapi=accel:/dev/dri/renderD128', '-filter_hw_device accel'],
          outputOptions: [
            `-vcodec h264_vaapi`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf format=nv12,hwupload,scale_vaapi=-2:720',
            '-qp 23',
            '-global_quality 23',
            '-rc_mode 1',
          ],
          twoPass: false,
        },
      );
    });

    it('should prefer gpu for vaapi if available', async () => {
      storageMock.readdir.mockResolvedValue(['card0', 'renderD129', 'renderD128']);
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.VAAPI }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device vaapi=accel:/dev/dri/card0', '-filter_hw_device accel'],
          outputOptions: [
            `-vcodec h264_vaapi`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf format=nv12,hwupload,scale_vaapi=-2:720',
            '-compression_level 7',
            '-qp 23',
            '-global_quality 23',
            '-rc_mode 1',
          ],
          twoPass: false,
        },
      );

      storageMock.readdir.mockResolvedValue(['renderD129', 'renderD128']);
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: ['-init_hw_device vaapi=accel:/dev/dri/renderD129', '-filter_hw_device accel'],
          outputOptions: [
            `-vcodec h264_vaapi`,
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf format=nv12,hwupload,scale_vaapi=-2:720',
            '-compression_level 7',
            '-qp 23',
            '-global_quality 23',
            '-rc_mode 1',
          ],
          twoPass: false,
        },
      );
    });

    it('should fallback to sw transcoding if hw transcoding fails', async () => {
      storageMock.readdir.mockResolvedValue(['renderD128']);
      mediaMock.probe.mockResolvedValue(probeStub.matroskaContainer);
      configMock.load.mockResolvedValue([{ key: SystemConfigKey.FFMPEG_ACCEL, value: TranscodeHWAccel.VAAPI }]);
      assetMock.getByIds.mockResolvedValue([assetEntityStub.video]);
      mediaMock.transcode.mockRejectedValueOnce(new Error('error'));
      await sut.handleVideoConversion({ id: assetEntityStub.video.id });
      expect(mediaMock.transcode).toHaveBeenCalledTimes(2);
      expect(mediaMock.transcode).toHaveBeenLastCalledWith(
        '/original/path.ext',
        'upload/encoded-video/user-id/asset-id.mp4',
        {
          inputOptions: [],
          outputOptions: [
            '-vcodec h264',
            '-acodec aac',
            '-movflags faststart',
            '-fps_mode passthrough',
            '-vf scale=-2:720',
            '-preset ultrafast',
            '-crf 23',
          ],
          twoPass: false,
        },
      );
    });
  });
});
