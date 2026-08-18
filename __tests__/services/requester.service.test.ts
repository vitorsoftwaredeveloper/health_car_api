import { Types } from "mongoose";

jest.mock("../../src/repositories/user.repository", () => ({
  userRepository: { findOne: jest.fn(), insertOne: jest.fn() },
}));
jest.mock("../../src/repositories/account.repository", () => ({
  accountRepository: { insertOne: jest.fn() },
}));
jest.mock("../../src/libs/mongo", () => ({
  withTransaction: jest.fn((operation: any) => operation({ id: "session" })),
}));

import { userRepository } from "../../src/repositories/user.repository";
import { accountRepository } from "../../src/repositories/account.repository";
import { resolveRequester } from "../../src/services/users/requester.service";
import { AuthClaims } from "../../src/types/auth";
import { DUPLICATE_KEY_ERROR_CODE } from "../../src/utils/errors";

const ownerClaims: AuthClaims = {
  sub: "cognito-sub-1",
  email: "vitor.ferreira@example.com",
  groups: ["owner"],
  role: "owner",
};

const storedUser = {
  _id: new Types.ObjectId(),
  accountId: new Types.ObjectId(),
  cognitoSub: ownerClaims.sub,
  name: "Vitor",
  email: ownerClaims.email,
  role: "owner" as const,
};

describe("resolveRequester", () => {
  it("devolve o usuário já existente", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(storedUser);

    const requester = await resolveRequester(ownerClaims);

    expect(requester.userId).toBe(storedUser._id);
    expect(requester.accountId).toBe(storedUser.accountId);
    expect(requester.role).toBe("owner");
    expect(accountRepository.insertOne).not.toHaveBeenCalled();
  });

  it("cria conta e usuário no primeiro login do proprietário", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(null);
    (userRepository.insertOne as jest.Mock).mockImplementation(
      async (data: any) => ({ toObject: () => data }),
    );

    const requester = await resolveRequester(ownerClaims);

    const account = (accountRepository.insertOne as jest.Mock).mock.calls[0][0];
    expect(account.plan).toBe("free");
    expect(account.vehicleLimit).toBe(3);
    expect(String(account.ownerId)).toBe(String(requester.userId));
    expect(String(requester.accountId)).toBe(String(account._id));
    expect(requester.user.name).toBe("Vitor Ferreira");
    expect(requester.user.preferences.pushEnabled).toBe(true);
  });

  it("recusa condutor sem convite", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      resolveRequester({ ...ownerClaims, role: "driver", groups: ["driver"] }),
    ).rejects.toMatchObject({ statusCode: 403, code: "USER_NOT_PROVISIONED" });
  });

  it("recusa token sem e-mail", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      resolveRequester({ ...ownerClaims, email: "" }),
    ).rejects.toMatchObject({ statusCode: 422, code: "EMAIL_REQUIRED" });
  });

  it("resolve corrida de provisionamento relendo o usuário", async () => {
    (userRepository.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedUser);
    (accountRepository.insertOne as jest.Mock).mockRejectedValue({
      code: DUPLICATE_KEY_ERROR_CODE,
    });

    const requester = await resolveRequester(ownerClaims);

    expect(requester.userId).toBe(storedUser._id);
  });

  it("devolve conflito quando o e-mail já pertence a outra conta", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(null);
    (accountRepository.insertOne as jest.Mock).mockRejectedValue({
      code: DUPLICATE_KEY_ERROR_CODE,
    });

    await expect(resolveRequester(ownerClaims)).rejects.toMatchObject({
      statusCode: 409,
      code: "EMAIL_ALREADY_REGISTERED",
    });
  });

  it("usa rótulo padrão quando o e-mail não tem parte local útil", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(null);
    (userRepository.insertOne as jest.Mock).mockImplementation(
      async (data: any) => ({ toObject: () => data }),
    );

    (accountRepository.insertOne as jest.Mock).mockResolvedValue({});

    const requester = await resolveRequester({ ...ownerClaims, email: "___@example.com" });

    expect(requester.user.name).toBe("Proprietário");
  });

  it("propaga erro que não é de chave duplicada", async () => {
    (userRepository.findOne as jest.Mock).mockResolvedValue(null);
    (accountRepository.insertOne as jest.Mock).mockRejectedValue(
      new Error("connection lost"),
    );

    await expect(resolveRequester(ownerClaims)).rejects.toThrow("connection lost");
  });
});
