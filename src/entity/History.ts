import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./User";

@Entity('histories')
export class History {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  bidder_id?: number;

  @Column()
  auction_id?: number;

  @Column('float')
  bid_price?: number;

  @Column()
  is_success?: boolean;

  @Column('timestamp')
  updated_at?: Date;
}