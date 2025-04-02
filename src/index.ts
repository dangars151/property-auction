import "reflect-metadata";
import express from "express";
import { AppDataSource } from "./data-source"; 
import { User } from "./entity/User";

const app = express();
app.use(express.json());

const PORT = 3000;

AppDataSource.initialize()
  .then(() => {
    console.log("🔗 Kết nối đến database thành công!");

    app.get("/users", async (req, res) => {
      const users = await AppDataSource.getRepository(User).find();
      res.json(users);
    });

    app.post("/users", async (req, res) => {
      const { email, password } = req.body;
      const user = new User();
      user.email = email;
      user.password = password;

      const result = await AppDataSource.getRepository(User).save(user);
      res.status(201).json(result);
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((error) => console.log("Lỗi khi kết nối với database: ", error));
