import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceAssignmentService } from './device-assignment.service';
import { DeviceAssignment } from './entities/device-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceAssignment])],
  providers: [DeviceAssignmentService],
  exports: [DeviceAssignmentService],
})
export class AccessModule {}
