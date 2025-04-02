import { DataSource } from "typeorm";
import { User } from "./entity/User";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: "localhost",
  port: 5432,
  username: "user",
  password: "pass",
  database: "property_auction",
  synchronize: false,
  logging: true,
  entities: [User],
  migrations: [],
  subscribers: [],
});
