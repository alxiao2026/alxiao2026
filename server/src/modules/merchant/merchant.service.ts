import { Injectable } from '@nestjs/common';
import { db } from '@/storage/database';
import { merchants } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

export interface CreateMerchantDto {
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  business_hours?: string;
  category?: string;
  description?: string;
}

export interface UpdateMerchantDto {
  name?: string;
  logo?: string;
  address?: string;
  phone?: string;
  business_hours?: string;
  category?: string;
  description?: string;
}

@Injectable()
export class MerchantService {
  async findAll() {
    const result = await db.select().from(merchants).orderBy(merchants.id);
    return result;
  }

  async findById(id: number) {
    const result = await db.select().from(merchants).where(eq(merchants.id, id));
    return result[0] || null;
  }

  async create(data: CreateMerchantDto) {
    const result = await db
      .insert(merchants)
      .values({
        name: data.name,
        logo: data.logo,
        address: data.address,
        phone: data.phone,
        business_hours: data.business_hours,
        category: data.category,
        description: data.description,
      })
      .returning();
    return result[0];
  }

  async update(id: number, data: UpdateMerchantDto) {
    const updateData: Record<string, any> = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.business_hours !== undefined) updateData.business_hours = data.business_hours;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;

    const result = await db
      .update(merchants)
      .set(updateData)
      .where(eq(merchants.id, id))
      .returning();
    return result[0];
  }

  async delete(id: number) {
    await db.delete(merchants).where(eq(merchants.id, id));
    return { success: true };
  }
}
