#!/bin/bash
set -e

echo "🚀 Đang khởi tạo database và các bảng PostgreSQL..."

psql -v ON_ERROR_STOP=1 --username "user" --dbname "property_auction" <<-EOSQL
  -- Chuyển sang database mới
  \c property_auction;

  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
  );

  CREATE TABLE auctions (
    id SERIAL PRIMARY KEY,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    base_price FLOAT NOT NULL,
    step_price FLOAT NOT NULL,
    current_bid FLOAT DEFAULT 0,
    highest_bidder_id INTEGER,
    updated_at TIMESTAMP,
    FOREIGN KEY (highest_bidder_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE histories (
    id SERIAL PRIMARY KEY,
    bidder_id INTEGER,
    auction_id INTEGER,
    bid_price FLOAT NOT NULL,
    is_success boolean,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (bidder_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE SET NULL
  );
EOSQL
