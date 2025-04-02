import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('auctions')
export class Auction {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column('timestamp')
  start_time?: Date;

  @Column('timestamp')
  end_time?: Date;

  @Column('float')
  base_price?: number;

  @Column('float')
  step_price?: number;

  @Column('float')
  current_bid?: number;

  @Column()
  highest_bidder_id?: number;

  @Column('timestamp')
  updated_at?: Date;
}