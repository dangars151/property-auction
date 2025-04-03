- B1: chạy docker-compose up --build để chạy postgres, redis và khởi tạo DB (nếu muốn xóa dữ liệu có thể chạy docker-compose down -v)
- B2: chạy npm install để cài đặt thư viện
- B3: chạy npx ts-node src/index.ts để chạy app
- B4: import file postman export để thử các API

- Một số phần có thể tối ưu thêm:
    + Khi đặt bid (API auctions/bid), có thể check thêm thời gian xem đã hết hạn chưa, query sẽ dạng
        id = :id AND :new_bid >= current_bid + step_price AND NOW() <= end_time
        Do scope của bài này không có chức năng tạo auction ban đầu nên chưa làm
    + Lúc update currend_bid vào redis có thể dùng websocket để trả lại kết quả luôn cho realtime
