import { GenericContainer, PostgreSqlContainer } from 'testcontainers';

let pg;
let redis;

export default async () => {
  process.env.NODE_ENV = 'development';
  process.env.TYPESENSE_API_KEY = 'abc123';

  pg = await new PostgreSqlContainer('postgres')
    .withExposedPorts(5432)
    .withDatabase('immich')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  process.env.DB_PORT = String(pg.getMappedPort(5432));
  process.env.DB_HOSTNAME = pg.getHost();
  process.env.DB_USERNAME = pg.getUsername();
  process.env.DB_PASSWORD = pg.getPassword();
  process.env.DB_DATABASE_NAME = pg.getDatabase();

  redis = await new GenericContainer('redis').withExposedPorts(6379).start();

  process.env.REDIS_PORT = String(redis.getMappedPort(6379));
  process.env.REDIS_HOSTNAME = redis.getHost();

  process.env.TYPESENSE_ENABLED = String(false);
  process.env.IMMICH_MACHINE_LEARNING_URL = String(false);
};
