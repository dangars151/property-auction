import "reflect-metadata";
import express, { Request, Response } from "express";
import { AppDataSource } from "./data-source"; 
import { User } from "./entity/User";
import { Auction } from './entity/Auction';
import { History } from './entity/History';
import dotenv from "dotenv";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
const Redis = require('ioredis');

dotenv.config();

const app = express();
app.use(express.json());

const redis = new Redis();

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
    
      res.status(201).json({ message: "Sign up successfully!" });
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

      const token = jwt.sign({ id: user.id, email: user.email }, secretKey, { expiresIn: '24h' });
    
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

    app.post("/auctions/bid", authenticateJWT, async (req: Request, res: Response) => {
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

      // Sử dụng sorted set để tối ưu việc lấy current_bid. Score chính là của sorted set chính là current_bid
      // Khi lấy current_bid thì sẽ lấy giá trị có current_bid lớn nhất
      // Để TTL = 3ph
      if (is_success) {
        const unixTime = Math.floor(new Date().getTime() / 1000);
        await redis.zadd('auction_' + auction_id, new_bid, unixTime);
        await redis.expire('auction_' + auction_id, 180)
      }

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
            updated_at: new Date(),
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

    app.get("/histories", authenticateJWT, async (req: Request, res: Response) => {
      const { auction_id } = req.query;

      const histories = await AppDataSource.getRepository(History).find({
        where: { auction_id: Number(auction_id) },
        order: { updated_at: 'desc' }
      });

      res.status(200).json({ histories });
    })

    /*
      - Đoạn này chia thành 2 API:
        + auctions/:id 
          -> lấy giá trị base_price và step_price trong DB vì 2 giá trị này không bao giờ thay đổi và chỉ cần 1 lần
          -> khi current_bid trong redis hết hạn thì có thể dùng luôn giá trị trong DB
        + auctions/:id/current_bid 
          -> lấy current_bid vì giá trị này sẽ thay đổi liên tục và được truy cập rất nhiều
          -> sử dụng sorted tối ưu hiệu năng để lấy điểm hiện tại (score lớn nhất)
    */
    app.get("/auctions/:id", authenticateJWT, async (req: Request, res: Response) => {
      const id = Number(req.params.id);

      const auction = await AppDataSource.getRepository(Auction).findOne({
        where: { id },
      });

      res.status(200).json({ auction });
    })

    app.get('/auctions/:id/current_bid', authenticateJWT, async (req: Request, res: Response) => {
      const id = Number(req.params.id);

      const result = await redis.zrevrange('auction_' + id, 0, 0, 'WITHSCORES');
  
      res.status(200).json({ highestValue: result[0], highestScore: result[1] });
  });

    app.listen(PORT, () => {
      console.log(`🚀 Server is running in http://localhost:${PORT}`);
    });
  })
  .catch((error) => console.log("Failed to connect to database: ", error));
