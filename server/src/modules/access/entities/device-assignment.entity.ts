import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Which devices a MANAGER user may see.
 *
 * Lives in its own module on purpose: both `users` and `devices` need it, so
 * putting it in either would create an import cycle. It stores plain ids and
 * depends on nothing.
 */
@Entity('device_assignments')
@Unique('uq_device_assignment', ['userId', 'deviceId'])
export class DeviceAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @ApiProperty()
  @Column({ name: 'device_id', type: 'uuid' })
  @Index()
  deviceId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
