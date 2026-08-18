import { Types } from "mongoose";

jest.mock("../../src/repositories/user.repository", () => ({
  userRepository: { findOneAndUpdate: jest.fn() },
}));
jest.mock("../../src/repositories/account.repository", () => ({
  accountRepository: { findById: jest.fn() },
}));
jest.mock("../../src/libs/crypto", () => ({
  encrypt: jest.fn(async (value: string) => `ENC:${value}`),
  decrypt: jest.fn(async (value: string) => value.replace("ENC:", "")),
}));

import { userRepository } from "../../src/repositories/user.repository";
import { accountRepository } from "../../src/repositories/account.repository";
import {
  acceptLgpdConsent,
  getMe,
  updateMe,
  updatePreferences,
} from "../../src/services/users/me.service";
import { defaultPreferences } from "../../src/domain/preferences";
import { Requester, UserDocument } from "../../src/types/user";

const userId = new Types.ObjectId();
const accountId = new Types.ObjectId();

const buildUser = (overrides: Partial<UserDocument> = {}): UserDocument => ({
  _id: userId,
  accountId,
  cognitoSub: "sub",
  name: "Vitor",
  email: "vitor@example.com",
  phone: "ENC:+5585999990000",
  role: "owner",
  preferences: defaultPreferences(),
  ...overrides,
});

const buildRequester = (user: UserDocument = buildUser()): Requester => ({
  userId,
  accountId,
  role: user.role,
  user,
});

const account = {
  _id: accountId,
  name: "Vitor",
  ownerId: userId,
  plan: "free",
  vehicleLimit: 3,
};

beforeEach(() => {
  (accountRepository.findById as jest.Mock).mockResolvedValue(account);
  (userRepository.findOneAndUpdate as jest.Mock).mockImplementation(
    async (_filter: any, update: any) => buildUser(update.$set),
  );
});

describe("getMe", () => {
  it("devolve perfil com telefone decifrado e marca o proprietário", async () => {
    const view = await getMe(buildRequester());

    expect(view.user.phone).toBe("+5585999990000");
    expect(view.user.id).toBe(String(userId));
    expect(view.account.isOwner).toBe(true);
    expect(view.account.vehicleLimit).toBe(3);
  });

  it("devolve telefone nulo quando não há telefone", async () => {
    const view = await getMe(buildRequester(buildUser({ phone: null })));

    expect(view.user.phone).toBeNull();
  });

  it("marca condutor como não proprietário", async () => {
    (accountRepository.findById as jest.Mock).mockResolvedValue({
      ...account,
      ownerId: new Types.ObjectId(),
    });

    const view = await getMe(buildRequester());

    expect(view.account.isOwner).toBe(false);
  });

  it("falha quando a conta não existe", async () => {
    (accountRepository.findById as jest.Mock).mockResolvedValue(null);

    await expect(getMe(buildRequester())).rejects.toMatchObject({
      statusCode: 404,
      code: "ACCOUNT_NOT_FOUND",
    });
  });
});

describe("updateMe", () => {
  it("cifra o telefone e apara o nome", async () => {
    await updateMe(buildRequester(), { name: "  Vitor Ferreira  ", phone: " +5585988887777 " });

    const update = (userRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update.name).toBe("Vitor Ferreira");
    expect(update.phone).toBe("ENC:+5585988887777");
  });

  it("limpa o telefone quando recebe null", async () => {
    await updateMe(buildRequester(), { phone: null });

    const update = (userRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update.phone).toBeNull();
  });

  it("grava tema dentro das preferências", async () => {
    await updateMe(buildRequester(), { theme: "dark" });

    const update = (userRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update.preferences.theme).toBe("dark");
    expect(update.preferences.pushEnabled).toBe(true);
  });

  it("não grava nada quando o payload é vazio", async () => {
    const view = await updateMe(buildRequester(), {});

    expect(userRepository.findOneAndUpdate).not.toHaveBeenCalled();
    expect(view.user.name).toBe("Vitor");
  });

  it("falha quando o usuário sumiu", async () => {
    (userRepository.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

    await expect(updateMe(buildRequester(), { name: "Novo" })).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });
  });
});

describe("updatePreferences", () => {
  it("mescla o patch com as preferências atuais", async () => {
    await updatePreferences(buildRequester(), {
      pushEnabled: false,
      milestones: { D30: false },
    });

    const update = (userRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update.preferences.pushEnabled).toBe(false);
    expect(update.preferences.milestones).toEqual({
      D30: false,
      D7: true,
      D0: true,
      OVERDUE_WEEKLY: true,
    });
  });
});

describe("acceptLgpdConsent", () => {
  it("grava data e versão dos termos", async () => {
    await acceptLgpdConsent(buildRequester(), { termsVersion: "1.0" });

    const update = (userRepository.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(update.lgpdTermsVersion).toBe("1.0");
    expect(update.lgpdAcceptedAt).toBeInstanceOf(Date);
  });
});
