import { Schema, Model, model, models } from "mongoose";
import { db } from "../libs/mongo";

export function createInstanceMongoose<T>(
  modelName: string,
  schema: Schema<T>,
) {
  const mongooseModel: Model<T> =
    (models[modelName] as Model<T>) || model<T>(modelName, schema);

  return {
    model: mongooseModel,
    insertOne: async (data: any, options?: any) => {
      await db();

      const document = new mongooseModel(data);
      return await document.save({ ...options });
    },
    updateOne: async (filter: any, data: any, options?: any) => {
      await db();
      return await mongooseModel.updateOne(filter, data, { ...options });
    },
    findOne: async (filter: any, projection?: any, options?: any) => {
      await db();
      return await mongooseModel.findOne(filter, projection, {
        ...options,
        lean: true,
      });
    },
    find: async (filter: any, projection?: any, options?: any) => {
      await db();
      return await mongooseModel.find(filter, projection, {
        ...options,
        lean: true,
      });
    },
    findById: async (id: any, projection?: any, options?: any) => {
      await db();
      return await mongooseModel.findById(id, projection, {
        ...options,
        lean: true,
      });
    },
    deleteOne: async (filter: any, options?: any) => {
      await db();
      return await mongooseModel.deleteOne(filter, { ...options });
    },
    count: async (filter: any, options?: any) => {
      await db();
      return await mongooseModel.countDocuments(filter, { ...options });
    },
  };
}
