import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DeviceAssignment } from './entities/device-assignment.entity';

/**
 * Manager -> device access, stored as plain ids.
 *
 * Both `users` and `devices` depend on this, and it depends on neither, so
 * the graph stays acyclic.
 */
@Injectable()
export class DeviceAssignmentService {
  constructor(
    @InjectRepository(DeviceAssignment)
    private readonly repo: Repository<DeviceAssignment>,
  ) {}

  async deviceIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.repo.find({ where: { userId }, select: { deviceId: true } });
    return rows.map((r) => r.deviceId);
  }

  async userIdsForDevice(deviceId: string): Promise<string[]> {
    const rows = await this.repo.find({ where: { deviceId }, select: { userId: true } });
    return rows.map((r) => r.userId);
  }

  async hasAccess(userId: string, deviceId: string): Promise<boolean> {
    return (await this.repo.countBy({ userId, deviceId })) > 0;
  }

  /** Full replace: whatever is passed becomes the complete assignment set. */
  async replaceForUser(userId: string, deviceIds: string[]): Promise<string[]> {
    const unique = [...new Set(deviceIds)];
    await this.repo.delete({ userId });
    if (unique.length) {
      await this.repo.insert(unique.map((deviceId) => ({ userId, deviceId })));
    }
    return unique;
  }

  async grant(userId: string, deviceIds: string[]): Promise<void> {
    const unique = [...new Set(deviceIds)];
    if (!unique.length) return;
    await this.repo
      .createQueryBuilder()
      .insert()
      .values(unique.map((deviceId) => ({ userId, deviceId })))
      .orIgnore()
      .execute();
  }

  async revoke(userId: string, deviceIds: string[]): Promise<void> {
    if (!deviceIds.length) return;
    await this.repo.delete({ userId, deviceId: In(deviceIds) });
  }

  /** Called when a device or user is removed, so no orphan rows linger. */
  async removeByDevice(deviceId: string): Promise<void> {
    await this.repo.delete({ deviceId });
  }

  async removeByUser(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
