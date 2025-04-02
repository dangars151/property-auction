import "reflect-metadata";
import express, { Request, Response } from "express";
import { AppDataSource } from "./data-source"; 
import { User } from "./entity/User";
import dotenv from "dotenv";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

AppDataSource.initialize()
  .then(() => {
    console.log("🔗 Connect database successfully!");

    app.post("/signup", async (req, res) => {
      const { email, password } = req.body;

      const user = await AppDataSource.getRepository(User).findOne({
        where: { email },
      });
    
      if (user) {
        res.status(400).json({ message: "User exist!" });
        return 
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
    
      const newUser: User = {
        email,
        password: hashedPassword,
      };

      await AppDataSource.getRepository(User).save(newUser);
    
      res.status(201).json({ message: "Đăng ký thành công!" });
    });

    app.post("/signin", async (req, res) => {
      const { email, password } = req.body;
    
      const user = await AppDataSource.getRepository(User).findOne({
        where: { email },
      });

      if (!user) {
        res.status(404).json({ message: "User not found!" });
        return 
      }
    
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.status(400).json({ message: "Incorrect password!" });
        return
      }
    
      const secretKey = process.env.JWT_SECRET;
      if (!secretKey) {
        throw new Error('JWT_SECRET is not defined in the environment variables');
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, secretKey, { expiresIn: '24h' });
    
      res.status(200).json({ token });
    });

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
