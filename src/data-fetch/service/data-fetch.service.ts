import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import { lastValueFrom } from 'rxjs';
import Lang from 'src/constants/language';
import { QueryBuilderService } from 'src/utils/query.builder.service';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { QueryInput } from '../dto/input/fetch.news.input';
import { PaginationInput } from '../dto/input/pagination.input';
import { GetNewsResponse } from '../dto/response/get.news.response';
import { NewsResponse } from '../dto/response/news.response';
import { News } from '../entities/news.entity';
import { NewsPost } from './../dto/response/news.response';

@Injectable()
export class DataFetchService {
  private readonly logger = new Logger(DataFetchService.name);

  constructor(
    @InjectRepository(News) private readonly newsRepository: Repository<News>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly queryBuilderService: QueryBuilderService,
    private readonly dataSource: DataSource,
  ) {}

  async deleteJsonFile() {
    const filePath = '/app/data/data.json';
    try {
      // delete the file
      await fs.unlink(filePath);
      this.logger.log('data.json file has been deleted .');
    } catch (error) {
      this.logger.error('Error deleting data.json file:', error.message);
    }
  }
  async fetchDocumentsFromApi(apiUrl: string): Promise<NewsResponse> {
    try {
      const response = await lastValueFrom(this.httpService.get(apiUrl));
      return response.data as NewsResponse;
    } catch (error) {
      this.logger.error(`Error fetching data from API: ${error.message}`);
      throw new InternalServerErrorException(
        `Error fetching data from API: ${error.message}`,
      );
    }
  }

  async writeDataToJSON(newsData: NewsPost[]) {
    try {
      const filePath = '/app/data/data.json';
      let existingData: NewsPost[] = [];

      try {
        const fileData = await fs.readFile(filePath, 'utf-8');
        existingData = JSON.parse(fileData) as NewsPost[];
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.error('Error parsing existing JSON data:', error.message);
          throw new UnprocessableEntityException(
            'Error parsing existing JSON data',
            error.message,
          );
        }
      }

      existingData.push(...newsData);
      await fs.writeFile(
        filePath,
        JSON.stringify(existingData, null, 4),
        'utf-8',
      );
      this.logger.log(
        `${newsData.length} post data has been successfully written to data.json`,
      );
    } catch (error) {
      await this.deleteJsonFile();

      this.logger.error('Error writing data to JSON file:', error.message);
      throw new InternalServerErrorException('Error writing data to JSON file');
    }
  }

  // Bulk insert posts from JSON file
  async bulkInsertPostsFromJSON() {
    const filePath = '/app/data/data.json';

    try {
      const fileData = await fs.readFile(filePath, 'utf-8');
      const posts = JSON.parse(fileData) as NewsPost[];
      this.logger.log(`Read ${posts.length} posts from JSON file`);

      if (posts.length === 0) {
        this.logger.log('No posts to insert.');
        return;
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Insert posts in batches
        const batchSize = 1000;
        const batchCount = Math.ceil(posts.length / batchSize);

        for (let i = 0; i < batchCount; i++) {
          const batchPosts = posts.slice(i * batchSize, (i + 1) * batchSize);

          await queryRunner.manager
            .createQueryBuilder()
            .insert()
            .into(News)
            .values(batchPosts)
            .orIgnore()
            .execute();

          this.logger.log(`Inserted batch ${i + 1} of ${batchCount}`);
        }

        await queryRunner.commitTransaction();
        this.logger.log('Bulk insert of posts completed successfully.');
      } catch (error) {
        await queryRunner.rollbackTransaction();

        this.logger.error('Error during bulk insert:', error.message);
        throw new InternalServerErrorException('Error during bulk insert');
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      this.logger.error('Error reading posts from JSON file:', error.message);
      throw new InternalServerErrorException(
        'Error reading posts from JSON file',
      );
    }
  }

  // Process the entire flow
  async processDocuments(
    query: QueryInput[],
    callback: (x: number, y: number) => void,
  ) {
    const token = this.configService.get<string>('WEBZ_IO_API_KEY');

    if (!token) {
      this.logger.error(Lang.WEB_HOSE_API_KEY_NOT_FOUND);
      throw new InternalServerErrorException(Lang.WEB_HOSE_API_KEY_NOT_FOUND);
    }

    const baseUrl = this.configService.get<string>('WEBZ_NEWS_URL');

    let fetchedNewsCount = 0;
    let nextUrl: string | null = null;
    let totalNews = 0;

    const queryString = this.queryBuilderService.build(query);
    const firstRequestUrl = `${baseUrl}/newsApiLite?token=${token}&q=${queryString}`;

    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      do {
        const data = await this.fetchDocumentsFromApi(
          nextUrl || firstRequestUrl,
        );
        const posts = data.posts;

        if (posts.length === 0) {
          this.logger.log(Lang.NO_MORE_POSTS);
          break;
        }

        await this.writeDataToJSON(posts);

        nextUrl = data.next ? `${baseUrl}${data.next}` : null;

        if (!nextUrl) {
          break;
        }

        fetchedNewsCount += posts.length;
        totalNews = data?.totalResults;
      } while (fetchedNewsCount !== totalNews);

      // Commit after fetching and writing to JSON
      await queryRunner.commitTransaction();

      // Bulk insert from the JSON file
      await this.bulkInsertPostsFromJSON();

      callback(fetchedNewsCount, totalNews - fetchedNewsCount);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      this.logger.error('Transaction failed:', error.message);

      throw new InternalServerErrorException(
        Lang.UNEXPECTED_API_DATA_FORMAT,
        error.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAllNews({
    page,
    limit,
  }: PaginationInput): Promise<GetNewsResponse> {
    const skip = (page - 1) * limit;

    const [news, total] = await this.newsRepository.findAndCount({
      skip,
      take: limit,
    });

    // calculate total page
    const totalPage = Math.ceil(total / limit);

    return { message: Lang.SUCCESS, posts: news, totalPage };
  }
}
