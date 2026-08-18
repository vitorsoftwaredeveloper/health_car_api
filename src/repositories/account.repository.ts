import { accountSchema } from "../models/account.model";
import { AccountDocument } from "../types/user";
import { createInstanceMongoose } from "./base";

export const accountRepository = createInstanceMongoose<AccountDocument>(
  "accounts",
  accountSchema,
);
