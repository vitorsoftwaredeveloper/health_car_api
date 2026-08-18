import { userSchema } from "../models/user.model";
import { UserDocument } from "../types/user";
import { createInstanceMongoose } from "./base";

export const userRepository = createInstanceMongoose<UserDocument>(
  "users",
  userSchema,
);
