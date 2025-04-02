import "reflect-metadata";
import express, { Request, Response } from "express";
import { AppDataSource } from "./data-source"; 
import { User } from "./entity/User";
import { Auction } from './entity/Auction';
import { History } from './entity/History';
import dotenv from "dotenv";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const authenticateJWT = (req: any, res: any, next: any) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(403).json({ message: "Token is empty" });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: "Token invalid" });
    }

    req.user = user;
    next();
  });
};

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

    app.get("/users", authenticateJWT, async (req: Request, res: Response) => {
      console.log(req.user)

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

    app.post("/auctions/bid", authenticateJWT, async (req, res) => {
      const { auction_id, new_bid } = req.body;

      if (new_bid <= 0) {
        res.status(400).json({ message: "New bid must be greater 0!" });
        return
      }

      /*
          - Cách làm thông thường là sẽ get auction by id
          - Check nếu new_bid >= current_bid + step_price thì cho update
          - Với các làm này có nhược điểm là khi lượng request cùng đặt cược vào 1 auction nhiều có thể xảy ra TH:
            + Giả sử current_bid = 50 (tr), step_price = 5 (tr)
            + Req1 đọc ra 50, req1 đặt thành 60
            + Req2 đọc ra 50, req2 đặt thành 55
            + Rõ ràng là khi đọc để update cả 2 request đều thấy thỏa mãn -> cùng update, giá trị sau cùng sẽ = 55 -> điều này rõ ràng là sai

          --------> Sử dụng Atomic operation
      */ 
      const result = await AppDataSource.getRepository(Auction)
      .createQueryBuilder()
      .update(Auction) 
      .set({ current_bid: new_bid }) 
      .where('id = :id AND :new_bid >= current_bid + step_price', {
        id: auction_id, 
        new_bid, 
      })
      .execute();
      
      var is_success = result.affected && result.affected > 0

      // Việc đưa lưu lịch sử vào setImmediate vì không muốn ảnh hưởng đến luồng chính
      // Cũng không cần phải await ở đây, vì việc xem lịch sử không phải quá nhiều và liên tục, nên sử dụng bất đồng bộ cho nhanh
      setImmediate(() => {
        AppDataSource.getRepository(History)
          .createQueryBuilder()
          .insert()
          .into(History)
          .values({
            bidder_id: req.user?.id,
            auction_id,
            bid_price: new_bid,
            is_success,
          })
          .execute()
          .catch((error) => console.error("Error inserting history:", error));
      });

      if (is_success) {
        res.status(200).json({ message: "Auction successful!" });
        return
      }

      res.status(200).json({ message: "Auction failed!" });
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server is running in http://localhost:${PORT}`);
    });
  })
  .catch((error) => console.log("Failed to connect to database: ", error));
